import { pool } from "@workspace/db";
import type { OrbitActionInput, Conversation } from "@workspace/api-zod";
import { categories, ensure, now, token, uid, type MemberRow, type WorkspaceRow, type ChatRow } from "./orbit-store";

const roles = ["Agent", "Supervisor", "Manager", "QA", "HR"];
const nonempty = (value: string | undefined, label: string, max = 5000): string => {
  ensure(typeof value === "string", `${label}: valor requerido.`);
  ensure(value.trim() && value.length <= max, `${label}: valor requerido (máximo ${max} caracteres).`);
  return value.trim();
};

export async function performAction(userId: string, action: OrbitActionInput): Promise<MemberRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const member = (await client.query<MemberRow>("SELECT * FROM orbit_members WHERE id=$1 FOR UPDATE", [userId])).rows[0]!;
    ensure(member, "Agente no encontrado.", 401);
    const workspace = (await client.query<WorkspaceRow>("SELECT * FROM orbit_workspaces WHERE id=$1 FOR UPDATE", [member.workspace_id])).rows[0]!;
    const chats = (await client.query<ChatRow>("SELECT * FROM orbit_conversations WHERE workspace_id=$1", [workspace.id])).rows;
    const owner = workspace.owner_id === member.id;
    let chat: Conversation | undefined;
    if (["claim", "open", "send", "saveNotes", "close", "saveCustomer"].includes(action.action)) {
      chat = chats.find(c => c.id === action.id)?.data;
      ensure(chat, "Conversación no encontrada.", 404);
      if (action.action !== "claim") ensure(chat.assignedTo === member.id, "Esta conversación está asignada a otro agente.", 403);
      ensure(chat.status !== "closed", "La conversación ya está cerrada.", 409);
    }
    switch (action.action) {
      case "claim": {
        ensure(chat!.status === "queued", "Otro agente ya tomó este chat.", 409);
        ensure(chats.filter(c => c.data.assignedTo === member.id && c.data.status === "active").length < 2, "Ya tienes dos chats activos. Finaliza uno antes de tomar otro.", 409);
        chat!.assignedTo = member.id;
        chat!.status = "active";
        break;
      }
      case "open": {
        if (!chat!.openedAt) { chat!.openedAt = now(); chat!.idleSince = now(); }
        break;
      }
      case "send": {
        const text = nonempty(action.text, "Mensaje");
        ensure(chat!.messages.length < 3000, "La conversación alcanzó el límite de mensajes.");
        chat!.messages.push({ id: uid(), from: "agent", text, createdAt: now() });
        chat!.openedAt ??= now();
        chat!.idleSince = now();
        break;
      }
      case "saveNotes": {
        ensure(action.version === chat!.version, "Las notas cambiaron en otra sesión. Recarga la conversación antes de guardar.", 409);
        ensure(action.category && categories[action.category]?.includes(action.subcategory ?? ""), "Selecciona una categoría y subcategoría válidas.");
        ensure(typeof action.notes === "string" && action.notes.length <= 20000, "Las notas deben tener como máximo 20 000 caracteres.");
        chat!.category = action.category; chat!.subcategory = action.subcategory!; chat!.notes = action.notes;
        chat!.version += 1;
        break;
      }
      case "close": {
        ensure(chat!.category && chat!.subcategory, "Guarda la categoría y subcategoría antes de finalizar.");
        ensure(typeof action.resolved === "boolean" && typeof action.firstContact === "boolean", "Indica el resultado de la atención.");
        chat!.status = "closed"; chat!.closedAt = now(); chat!.idleSince = null;
        chat!.resolved = action.resolved; chat!.firstContact = action.firstContact;
        break;
      }
      case "saveCustomer": {
        ensure(action.customer, "Faltan datos del cliente.");
        nonempty(action.customer.name, "Nombre", 100);
        ensure(Object.values(action.customer).every(v => v.length <= 300), "Datos del cliente demasiado largos.");
        ensure(!action.customer.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(action.customer.email), "Correo inválido.");
        chat!.customer = action.customer;
        break;
      }
      case "saveOrder": {
        ensure(owner, "Solo el administrador puede registrar pedidos.", 403);
        const order = action.order;
        ensure(order, "Falta el pedido.");
        nonempty(order.number, "Número de pedido", 100);
        ensure(["pending", "in_transit", "delivered", "cancelled"].includes(order.status), "Estado de pedido inválido.");
        ensure(!isNaN(Date.parse(order.purchasedAt)), "Fecha de compra inválida.");
        ensure(order.events.length <= 100 && JSON.stringify(order).length < 30000, "Pedido demasiado grande.");
        ensure(!workspace.data.orders.some(o => o.number.toLowerCase() === order.number.toLowerCase() && o.id !== order.id), "Ese número de pedido ya existe.", 409);
        const index = workspace.data.orders.findIndex(o => o.id === order.id);
        const record = { ...order, id: index >= 0 ? order.id : uid() };
        if (index >= 0) workspace.data.orders[index] = record;
        else workspace.data.orders.push(record);
        break;
      }
      case "saveArticle": {
        ensure(owner, "Solo el administrador puede editar artículos.", 403);
        const article = action.article;
        ensure(article, "Falta el artículo.");
        article.title = nonempty(article.title, "Título", 200);
        article.body = nonempty(article.body, "Contenido", 50000);
        article.category = nonempty(article.category, "Categoría", 100);
        const index = workspace.data.articles.findIndex(a => a.id === article.id);
        const record = { ...article, id: index >= 0 ? article.id : uid() };
        if (index >= 0) workspace.data.articles[index] = record;
        else workspace.data.articles.push(record);
        break;
      }
      case "deleteArticle": {
        ensure(owner, "Solo el administrador puede eliminar artículos.", 403);
        ensure(workspace.data.articles.some(a => a.id === action.id), "Artículo no encontrado.", 404);
        workspace.data.articles = workspace.data.articles.filter(a => a.id !== action.id);
        break;
      }
      case "contact": {
        ensure(action.role && roles.includes(action.role), "Rol no válido.");
        workspace.data.contactMessages.push({ id: uid(), from: member.id, toRole: action.role, text: nonempty(action.text, "Mensaje"), createdAt: now() });
        break;
      }
      case "profile": {
        const name = nonempty(action.name, "Nombre", 100);
        ensure(action.role && roles.includes(action.role), "Rol no válido.");
        await client.query("UPDATE orbit_members SET name=$1,role=$2 WHERE id=$3", [name, action.role, userId]);
        member.name = name; member.role = action.role;
        break;
      }
      case "rotateInvite": {
        ensure(owner, "Solo el administrador puede renovar la invitación.", 403);
        await client.query("UPDATE orbit_workspaces SET invite_code=$1 WHERE id=$2", [token(), workspace.id]);
        break;
      }
      case "join": {
        ensure(!chats.some(c => c.data.status === "active" && c.data.assignedTo === member.id), "Finaliza tus chats activos antes de cambiar de equipo.", 409);
        if (owner) {
          const count = await client.query("SELECT count(*)::int AS count FROM orbit_members WHERE workspace_id=$1", [workspace.id]);
          ensure(count.rows[0].count === 1, "El administrador no puede abandonar un equipo con otros miembros.", 409);
        }
        const target = (await client.query<WorkspaceRow>("SELECT * FROM orbit_workspaces WHERE invite_code=$1", [action.inviteCode ?? ""])).rows[0];
        ensure(target && target.id !== workspace.id, "Código inválido o ya perteneces a ese equipo.");
        await client.query("UPDATE orbit_members SET workspace_id=$1,role='Agent' WHERE id=$2", [target.id, userId]);
        member.workspace_id = target.id; member.role = "Agent";
        break;
      }
    }
    if (chat) await client.query("UPDATE orbit_conversations SET data=$1 WHERE id=$2", [JSON.stringify(chat), chat.id]);
    await client.query("UPDATE orbit_workspaces SET data=$1 WHERE id=$2", [JSON.stringify(workspace.data), workspace.id]);
    await client.query("COMMIT");
    return member;
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}
