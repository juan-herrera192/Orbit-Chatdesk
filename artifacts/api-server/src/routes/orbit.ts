import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import {
  PerformOrbitActionBody, GetOrbitStateResponse, StartVisitorChatBody,
  StartVisitorChatResponse, GetVisitorChatResponse, SendVisitorMessageBody, RateVisitorChatBody,
} from "@workspace/api-zod";
import type { Conversation } from "@workspace/api-zod";
import { AppError, ensure, memberFor, getState, uid, token, hash, now, visitorView, type WorkspaceRow, type ChatRow } from "../lib/orbit-store";
import { performAction } from "../lib/orbit-actions";

const router = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

// No client-provided identity is trusted. Clerk verifies the session cookie.
router.get("/orbit/state", wrap(async (req, res) => {
  const { userId } = getAuth(req);
  ensure(userId, "Inicia sesión para continuar.", 401);
  res.setHeader("Cache-Control", "no-store");
  res.json(GetOrbitStateResponse.parse(await getState(await memberFor(userId))));
}));

router.post("/orbit/action", wrap(async (req, res) => {
  const { userId } = getAuth(req);
  ensure(userId, "Inicia sesión para continuar.", 401);
  const parsed = PerformOrbitActionBody.safeParse(req.body);
  ensure(parsed.success, "Solicitud inválida.");
  await memberFor(userId);
  res.json(GetOrbitStateResponse.parse(await getState(await performAction(userId, parsed.data))));
}));

router.get("/orbit/public/workspace/:key", wrap(async (req, res) => {
  const workspace = (await pool.query<WorkspaceRow>("SELECT name FROM orbit_workspaces WHERE public_key=$1", [req.params.key])).rows[0];
  ensure(workspace, "El enlace de atención no existe.", 404);
  res.json({ name: workspace.name });
}));

// Per-IP sliding window protects the public entry point without retaining addresses.
const limits = new Map<string, { count: number; until: number }>();
router.use("/orbit/public", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") { next(); return; }
  const key = hash(req.ip || req.socket.remoteAddress || "unknown");
  const time = Date.now();
  if (limits.size > 10000) for (const [k, v] of limits) if (v.until < time) limits.delete(k);
  let value = limits.get(key);
  if (!value || value.until < time) { value = { count: 0, until: time + 60000 }; limits.set(key, value); }
  if (++value.count > 40) { res.status(429).json({ error: "Demasiadas solicitudes. Espera un minuto." }); return; }
  next();
});

router.post("/orbit/public/chats", wrap(async (req, res) => {
  const parsed = StartVisitorChatBody.safeParse(req.body);
  ensure(parsed.success, "Completa los datos y tu mensaje.");
  const input = parsed.data;
  ensure(input.customer.name.trim() && input.text.trim(), "El nombre y mensaje son obligatorios.");
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email), "Introduce un correo válido.");
  ensure(Object.values(input.customer).every(v => v.length <= 300), "Los datos del cliente son demasiado largos.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const workspace = (await client.query<WorkspaceRow>("SELECT * FROM orbit_workspaces WHERE public_key=$1 FOR UPDATE", [input.workspaceKey])).rows[0];
    ensure(workspace, "Enlace de atención no válido.", 404);
    const count = await client.query("SELECT count(*)::int AS count FROM orbit_conversations WHERE workspace_id=$1 AND data->>'status' <> 'closed'", [workspace.id]);
    ensure(count.rows[0].count < 100, "La cola de atención está llena. Inténtalo más tarde.", 409);
    const secret = token();
    const conversation: Conversation = {
      id: uid(), customer: input.customer, status: "queued", assignedTo: "", openedAt: null, idleSince: null,
      createdAt: now(), closedAt: null, category: "", subcategory: "", notes: "", version: 0,
      resolved: false, firstContact: false, score: null,
      messages: [{ id: uid(), from: "customer", text: input.text.trim(), createdAt: now() }],
    };
    await client.query("INSERT INTO orbit_conversations(id,workspace_id,token_hash,data) VALUES($1,$2,$3,$4)", [conversation.id, workspace.id, hash(secret), JSON.stringify(conversation)]);
    await client.query("COMMIT");
    res.json(StartVisitorChatResponse.parse({ token: secret, conversation: visitorView(conversation) }));
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}));

router.get("/orbit/public/chats/:token", wrap(async (req, res) => {
  const result = await pool.query<ChatRow>("SELECT data FROM orbit_conversations WHERE token_hash=$1", [hash(String(req.params.token))]);
  ensure(result.rows[0], "Conversación no encontrada.", 404);
  res.json(GetVisitorChatResponse.parse(visitorView(result.rows[0].data)));
}));

for (const action of ["messages", "rating"] as const) {
  router.post(`/orbit/public/chats/:token/${action}`, wrap(async (req, res) => {
    const parsed = action === "messages" ? SendVisitorMessageBody.safeParse(req.body) : RateVisitorChatBody.safeParse(req.body);
    ensure(parsed.success, "Solicitud inválida.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lookup = (await client.query<ChatRow>("SELECT * FROM orbit_conversations WHERE token_hash=$1", [hash(String(req.params.token))])).rows[0];
      ensure(lookup, "Conversación no encontrada.", 404);
      // Same lock ordering as the staff mutations prevents lost updates.
      await client.query("SELECT id FROM orbit_workspaces WHERE id=$1 FOR UPDATE", [lookup.workspace_id]);
      const row = (await client.query<ChatRow>("SELECT * FROM orbit_conversations WHERE id=$1 FOR UPDATE", [lookup.id])).rows[0]!;
      const chat = row.data;
      if (action === "messages") {
        const input = SendVisitorMessageBody.parse(parsed.data);
        ensure(input.text.trim(), "El mensaje no puede estar vacío.");
        ensure(chat.status !== "closed", "Esta conversación ya terminó.", 409);
        ensure(chat.messages.length < 3000, "La conversación alcanzó el límite de mensajes.");
        chat.messages.push({ id: uid(), from: "customer", text: input.text.trim(), createdAt: now() });
      } else {
        ensure(chat.status === "closed", "La encuesta se habilita al finalizar el chat.", 409);
        ensure(chat.score === null, "Ya registramos tu valoración.", 409);
        chat.score = RateVisitorChatBody.parse(parsed.data).score;
      }
      await client.query("UPDATE orbit_conversations SET data=$1 WHERE id=$2", [JSON.stringify(chat), chat.id]);
      await client.query("COMMIT");
      res.json(GetVisitorChatResponse.parse(visitorView(chat)));
    } catch (err) { await client.query("ROLLBACK"); throw err; }
    finally { client.release(); }
  }));
}

router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) { res.status(error.status).json({ error: error.message }); return; }
  req.log.error({ err: error }, "Orbit request failed");
  res.status(500).json({ error: "No se pudo completar la operación. Vuelve a intentarlo." });
});
export default router;
