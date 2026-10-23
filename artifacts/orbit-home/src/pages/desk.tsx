import { useState } from "react";
import { Bell, BookOpen, LayoutDashboard, MessageCircle, Users, X } from "lucide-react";
import type { Conversation } from "@workspace/api-client-react";
import { useOrbit, errorText } from "@/hooks/use-orbit";
import { CustomerPanel } from "@/components/orbit/customer-panel";
import { Contacts, Dashboard, Knowledge } from "@/components/orbit/resources";
import { Profile } from "@/components/orbit/profile";
import { Composer, duration, elapsed, Empty, initials, Loading, Logo, Messages, Modal, tone, useClock } from "@/components/orbit/shared";
import "@/components/orbit/base.css";
import "@/components/orbit/AgentDesk.css";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "contacts", label: "Contactos", icon: Users },
  { id: "conversations", label: "Conversaciones", icon: MessageCircle },
];

export default function Desk() {
  const orbit = useOrbit();
  const [page, setPage] = useState("conversations");
  const [selected, setSelected] = useState("");
  const [archive, setArchive] = useState(false);
  const [modal, setModal] = useState<"profile" | "notifications" | null>(null);
  const [closing, setClosing] = useState(false);
  const [resolved, setResolved] = useState(true);
  const [firstContact, setFirstContact] = useState(true);
  const [closeError, setCloseError] = useState("");
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const now = useClock();
  const state = orbit.data;

  if (!state) {
    return <div className="orbit-desk">
      {orbit.isError ? <Empty title="No pudimos cargar tu espacio">
        <p>{errorText(orbit.queryError)}</p>
        <button data-testid="button-retry-workspace" className="contact-action" onClick={() => void orbit.refetch()}>Volver a intentar</button>
      </Empty> : <Loading />}
    </div>;
  }

  const mine = state.conversations.filter(c => c.status === "active" && c.assignedTo === state.me.id);
  const queued = state.conversations.filter(c => c.status === "queued");
  const closed = state.conversations.filter(c => c.status === "closed");
  const active = state.conversations.find(c => c.id === selected);
  const notifications = [...queued, ...mine.filter(c => !c.openedAt)];
  const act = orbit.act;
  const publicLink = `${window.location.origin}/chat/${state.publicKey}`;
  const pageName = page === "dashboard" ? "Dashboard" : page === "contacts" ? "Contactos" : page === "kb" ? "Base de conocimiento" : "Chat Support";

  async function select(c: Conversation) {
    if (!state) return;
    try {
      if (c.status === "queued") await act({ action: "claim", id: c.id });
      else if (c.status === "active" && c.assignedTo !== state.me.id) return;
      setSelected(c.id);
      setPage("conversations");
      setModal(null);
      if (c.status !== "closed" && !c.openedAt) await act({ action: "open", id: c.id });
    } catch {
      // The shell displays the failure; assignment/capacity stay server-authoritative.
    }
  }

  function rail(c: Conversation) {
    const seconds = elapsed(c.idleSince, now);
    const status = c.status === "closed" ? "Archivo" : c.status === "queued" ? "Tomar" : !c.openedAt ? "Nuevo" : duration(seconds);
    return <button
      key={c.id}
      data-testid={`button-conversation-${c.id}`}
      className={`recent-card ${c.status === "active" ? tone(seconds) : ""} ${selected === c.id ? "selected" : ""} ${c.status !== "closed" && !c.openedAt ? "incoming" : ""}`}
      disabled={orbit.pending || (c.status === "queued" && mine.length >= 2)}
      onClick={() => void select(c)}
      aria-pressed={selected === c.id}
      aria-label={`${c.customer.name}, ${status}${seconds >= 120 && c.status === "active" ? ", requiere atención" : ""}`}
    >
      <span className="recent-card-head"><strong>{c.customer.name}</strong><small>{status}</small></span>
      <p>{c.messages.at(-1)?.text || "Sin mensajes"}</p>
    </button>;
  }

  return <div className="orbit-desk" data-idle={tone(elapsed(active?.idleSince || null, now))}>
    <div className="orbit-shell">
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="sidebar-logo" title="Orbit Home"><Logo /></div>
        <nav className="sidebar-nav">
          {navigation.map(n => <button data-testid={`nav-${n.id}`} key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
            <n.icon size={23} /><span>{n.label}</span>
          </button>)}
        </nav>
        <button data-testid="nav-kb" className={`nav-item kb-nav ${page === "kb" ? "active" : ""}`} onClick={() => setPage("kb")}><BookOpen size={23} /><span>KB</span></button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="page-brand"><strong>{pageName}</strong><span>{state.workspaceName}</span></div>
          <div className="top-actions">
            <button data-testid="button-notifications" className="notification-button" aria-label={`Notificaciones (${notifications.length})`} onClick={() => setModal("notifications")}>
              <Bell size={21} />{notifications.length > 0 && <i />}
            </button>
            <button data-testid="button-profile" className="profile plain-profile" onClick={() => setModal("profile")} aria-label="Abrir perfil">
              <div className="profile-copy">{state.me.name}<span>{state.me.role}</span></div><div className="avatar">{initials(state.me.name)}</div>
            </button>
          </div>
        </header>
        {orbit.error && <div data-testid="status-action-error" role="alert" className="error-banner">
          {orbit.error}<button className="text-link" style={{ marginLeft: 14 }} onClick={() => orbit.setError("")}>Cerrar aviso</button>
        </div>}
        {orbit.isError && <div className="error-banner" role="alert">
          No se pudo actualizar la información. Mostramos la última versión disponible. <button className="text-link" onClick={() => void orbit.refetch()}>Reintentar</button>
        </div>}
        {page === "dashboard" && <Dashboard state={state} />}
        {page === "contacts" && <Contacts state={state} act={act} pending={orbit.pending} />}
        {page === "kb" && <Knowledge state={state} act={act} pending={orbit.pending} />}
        <div className="conversation-layout" style={page !== "conversations" ? { display: "none" } : undefined}>
          <aside className="recent-panel">
            <div className="recent-heading">Conversaciones<MessageCircle size={14} /></div>
            <div className="recent-subtitle">Chats abiertos ({mine.length})</div>
            {mine.map(rail)}
            {!mine.length && <p className="muted-copy">No tienes chats activos.</p>}
            <div className="capacity">
              <label>Capacidad de atención<span data-testid="text-capacity">{mine.length} / 2</span></label>
              <div className="capacity-bar"><i style={{ width: `${mine.length * 50}%` }} /></div>
            </div>
            <div className="recent-heading" style={{ marginTop: 24 }}>En espera <span>{queued.length}</span></div>
            <p className="muted-copy">{mine.length >= 2 ? "Finaliza una conversación antes de tomar otra." : "Selecciona una consulta para atenderla."}</p>
            {queued.map(rail)}
            <button data-testid="button-toggle-archive" className="text-link" onClick={() => setArchive(!archive)}>{archive ? "Ocultar archivo" : `Ver archivo (${closed.length})`}</button>
            {archive && closed.map(rail)}
            {archive && !closed.length && <p className="muted-copy">Aún no hay conversaciones finalizadas.</p>}
          </aside>
          <div className="desk-body">
            <main className="workspace">
              {active ? <section className="chat-panel" aria-label={`Conversación con ${active.customer.name}`}>
                <div className="chat-context">
                  <span className="context-pill">{active.customer.name}</span>
                  {active.customer.orderNumber && <span className="context-pill order">Pedido {active.customer.orderNumber}</span>}
                  {active.status === "active" && active.assignedTo === state.me.id && <button data-testid="button-end-chat" className="resolve-button" disabled={orbit.pending} onClick={() => {
                    setClosing(true); setResolved(true); setFirstContact(true); setCloseError("");
                  }}><X size={13} />Finalizar chat</button>}
                  {active.status === "closed" && <span className="context-pill order">Finalizado</span>}
                </div>
                <Messages messages={active.messages} customer={active.customer.name} agent={state.me.name} />
                {active.status === "active" && active.assignedTo === state.me.id ? <Composer
                  key={`${state.workspaceId}-${active.id}`}
                  pending={orbit.pending}
                  disabled={!active.openedAt}
                  draft={messageDrafts[`${state.workspaceId}-${active.id}`] || ""}
                  onDraftChange={text => setMessageDrafts(d => ({ ...d, [`${state.workspaceId}-${active.id}`]: text }))}
                  send={text => act({ action: "send", id: active.id, text })}
                /> : <div className="composer-wrap"><p className="composer-hint">Archivo de la conversación · Solo lectura</p></div>}
              </section> : <section className="chat-panel" style={{ gridColumn: "1/-1" }}>
                <Empty title="Todo listo para acompañar">
                  <p>Recibe consultas reales compartiendo el enlace público de tu espacio. Puedes atender dos conversaciones al mismo tiempo.</p>
                  <button data-testid="button-share-empty" className="contact-action" onClick={() => setModal("profile")}>Compartir enlace de atención</button>
                  <a className="text-link" href={publicLink} target="_blank" rel="noreferrer">Ver portal del cliente</a>
                </Empty>
              </section>}
              {/* Keep both customer panels mounted while switching/closing chats.
                  Each panel owns its independent draft; polling never remounts it. */}
              {[...mine, ...(active?.status === "closed" ? [active] : [])].map(c => <div
                key={`${state.workspaceId}-${c.id}`}
                style={c.id !== active?.id ? { display: "none" } : { display: "contents" }}
              ><CustomerPanel conversation={c} state={state} act={act} pending={orbit.pending} /></div>)}
            </main>
          </div>
        </div>
      </div>
    </div>
    {modal && <Modal title={modal === "profile" ? "Tu espacio de trabajo" : "Notificaciones"} close={() => setModal(null)}>
      {modal === "profile" ? <Profile key={state.workspaceId} state={state} act={act} pending={orbit.pending} /> : <>
        {orbit.error && <p role="alert" className="muted-copy">{orbit.error}</p>}
        {mine.length >= 2 && queued.length > 0 && <p className="route-intro">Tu capacidad está completa. Finaliza un chat para tomar otra consulta.</p>}
        {notifications.length ? notifications.map(c => <button data-testid={`notification-${c.id}`} className="notice" key={c.id} disabled={orbit.pending || (c.status === "queued" && mine.length >= 2)} onClick={() => void select(c)}>
          Nueva conversación de {c.customer.name}<small>{c.status === "queued" ? "En espera de un agente" : "Pendiente de abrir"}</small>
        </button>) : <Empty title="Estás al día"><p>Las nuevas consultas aparecerán aquí.</p></Empty>}
      </>}
    </Modal>}
    {closing && active && <Modal title="Finalizar conversación" close={() => setClosing(false)}>
      <p className="route-intro">El historial quedará disponible en el archivo. Confirma el resultado de esta atención.</p>
      <div className="form-stack" style={{ marginTop: 20 }}>
        <label className="checkbox-label"><input data-testid="checkbox-resolved" type="checkbox" checked={resolved} onChange={e => { setResolved(e.target.checked); if (!e.target.checked) setFirstContact(false); }} />¿Se resolvió la consulta?</label>
        <label className="checkbox-label"><input data-testid="checkbox-first-contact" type="checkbox" checked={firstContact} disabled={!resolved} onChange={e => setFirstContact(e.target.checked)} />¿Se resolvió en el primer contacto?</label>
        {(!active.category || !active.subcategory) && <p className="muted-copy">Antes de finalizar, guarda una categoría y subcategoría en «Disposición y notas».</p>}
        {closeError && <p role="alert">{closeError}</p>}
        <button data-testid="button-confirm-close" className="contact-action" disabled={orbit.pending || !active.category || !active.subcategory} onClick={async () => {
          try {
            await act({ action: "close", id: active.id, resolved, firstContact: resolved && firstContact });
            setClosing(false); setSelected("");
          } catch (e) { setCloseError(errorText(e)); }
        }}>Confirmar y finalizar</button>
        <button className="text-link" onClick={() => setClosing(false)}>Volver a la conversación</button>
      </div>
    </Modal>}
  </div>;
}
