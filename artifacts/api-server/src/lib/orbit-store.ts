import { randomBytes, randomUUID, createHash } from "node:crypto";
import { pool } from "@workspace/db";
import type { Article, Conversation, ContactMessage, Member, Order, OrbitState } from "@workspace/api-zod";

export type WorkspaceData = { articles: Article[]; orders: Order[]; contactMessages: ContactMessage[] };
export type WorkspaceRow = { id: string; name: string; owner_id: string; public_key: string; invite_code: string; data: WorkspaceData };
export type MemberRow = Member & { workspace_id: string };
export type ChatRow = { id: string; workspace_id: string; token_hash: string; data: Conversation };
export const uid = () => randomUUID();
export const token = () => randomBytes(24).toString("base64url");
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const now = () => new Date().toISOString();
export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(status, message);
}

const initialArticles: Article[] = [
  { id: "order-guide", title: "Consultar el estado de un pedido", category: "Guía inicial", body: "Confirma el número de pedido y el correo del cliente. Consulta Seguimiento. Los pedidos se registran manualmente por el administrador: no hay conexión automática con transportistas. Si no hay información, no prometas una fecha de entrega." },
  { id: "support-guide", title: "Registrar una atención", category: "Guía inicial", body: "Selecciona una categoría y subcategoría en Disposición y notas. Guarda el contexto relevante antes de cerrar. Marca si el problema quedó resuelto y si se resolvió en el primer contacto. El cliente podrá calificar la atención al finalizar." },
  { id: "escalation-guide", title: "Escalar una consulta", category: "Guía inicial", body: "Utiliza Contactos para enviar un mensaje al rol correspondiente. Los mensajes permanecen en el buzón interno del equipo. No se envían correos externos. No compartas contraseñas ni datos de pago en las notas." },
];

export async function memberFor(userId: string): Promise<MemberRow> {
  const existing = await pool.query<MemberRow>("SELECT * FROM orbit_members WHERE id=$1", [userId]);
  if (existing.rows[0]) return existing.rows[0];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize first visits from multiple tabs of the same identity.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const found = await client.query<MemberRow>("SELECT * FROM orbit_members WHERE id=$1", [userId]);
    if (found.rows[0]) { await client.query("COMMIT"); return found.rows[0]; }
    const workspaceId = uid();
    await client.query("INSERT INTO orbit_workspaces(id,name,owner_id,public_key,invite_code,data) VALUES($1,$2,$3,$4,$5,$6)", [
      workspaceId, "Orbit Home", userId, token(), token(), JSON.stringify({ articles: initialArticles, orders: [], contactMessages: [] }),
    ]);
    const result = await client.query<MemberRow>("INSERT INTO orbit_members(id,workspace_id,name,role) VALUES($1,$2,$3,$4) RETURNING *", [userId, workspaceId, "Agente", "Agent"]);
    await client.query("COMMIT");
    return result.rows[0]!;
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}

export async function getState(member: MemberRow): Promise<OrbitState> {
  const [workspaceResult, membersResult, chatsResult] = await Promise.all([
    pool.query<WorkspaceRow>("SELECT * FROM orbit_workspaces WHERE id=$1", [member.workspace_id]),
    pool.query<MemberRow>("SELECT * FROM orbit_members WHERE workspace_id=$1 ORDER BY name", [member.workspace_id]),
    pool.query<ChatRow>("SELECT * FROM orbit_conversations WHERE workspace_id=$1 ORDER BY created_at DESC", [member.workspace_id]),
  ]);
  const workspace = workspaceResult.rows[0]!;
  const conversations = chatsResult.rows.map(row => row.data);
  const month = new Date().toISOString().slice(0, 7);
  const monthly = conversations.filter(chat => chat.assignedTo === member.id && chat.createdAt.startsWith(month));
  const closed = monthly.filter(chat => chat.status === "closed");
  const ratings = closed.filter(chat => chat.score !== null);
  const nps = ratings.length ? Math.round(100 * (ratings.filter(c => c.score! >= 9).length - ratings.filter(c => c.score! <= 6).length) / ratings.length) : null;
  return {
    workspaceId: workspace.id, workspaceName: workspace.name, publicKey: workspace.public_key,
    inviteCode: workspace.owner_id === member.id ? workspace.invite_code : "", owner: workspace.owner_id === member.id,
    me: { id: member.id, name: member.name, role: member.role },
    members: membersResult.rows.map(({ id, name, role }) => ({ id, name, role })),
    conversations, articles: workspace.data.articles, orders: workspace.data.orders,
    contactMessages: workspace.data.contactMessages.filter(m => m.from === member.id || m.toRole === member.role),
    metrics: { month, chats: monthly.length, closed: closed.length, nps, responses: ratings.length,
      fcr: closed.length ? Math.round(100 * closed.filter(c => c.resolved && c.firstContact).length / closed.length) : null,
      closedRate: monthly.length ? Math.round(100 * closed.length / monthly.length) : null },
  };
}

// Visitor responses never disclose staff notes, classifications or internal identities.
export function visitorView(chat: Conversation): Conversation {
  return { ...chat, assignedTo: "", category: "", subcategory: "", notes: "", version: 0,
    customer: { ...chat.customer, email: "", phone: "", since: "" } };
}

export const categories: Record<string, string[]> = {
  "Customer Service": ["Estado del pedido", "Entrega y transporte", "Cambio o devolución", "Facturación y pagos", "Actualización de datos"],
  "Tech Support": ["Instalación y montaje", "Configuración del producto", "Problema de funcionamiento", "Conectividad", "Garantía y reparación"],
  Sales: ["Información de producto", "Disponibilidad", "Cotización", "Nueva compra", "Accesorios y complementos"],
  Retention: ["Solicitud de cancelación", "Insatisfacción con el producto", "Oferta de permanencia", "Seguimiento de satisfacción"],
};
