import "./AgentDesk.css";
import { useEffect, useState } from "react";
import {
  Bell,
  BarChart3,
  LayoutDashboard,
  Users,
  BookOpen,
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type ChatId = "jordan" | "sofia";
type WorkspaceTab = "info" | "notes" | "order";
type Chat = {
  id: ChatId;
  name: string;
  initials: string;
  order: string;
  model: string;
  phone: string;
  email: string;
  tenure: string;
  intro: string;
};

const chats: Record<ChatId, Chat> = {
  jordan: {
    id: "jordan",
    name: "Jordan Reyes",
    initials: "JR",
    order: "#1048",
    model: "OH-AERO-02",
    phone: "+1 (415) 555-0186",
    email: "jordan.reyes@email.com",
    tenure: "Cliente desde hace 2 años",
    intro: "Consulta sobre la entrega de su escritorio Aero.",
  },
  sofia: {
    id: "sofia",
    name: "Sofia Chen",
    initials: "SC",
    order: "#1092",
    model: "OH-LUNA-01",
    phone: "+1 (206) 555-0124",
    email: "sofia.chen@email.com",
    tenure: "Cliente desde hace 8 meses",
    intro: "Pregunta por el montaje de su lámpara Luna.",
  },
};

const initialMessages: Record<ChatId, { from: "customer" | "agent"; text: string; time: string }[]> = {
  jordan: [
    { from: "customer", text: "Hi! I’m checking in on my Aero desk order. The delivery note says it should arrive tomorrow, but I haven’t seen a tracking update yet.", time: "10:24" },
    { from: "agent", text: "Hi Jordan — happy to take a look. I can see order #1048 here. I’m checking the latest carrier information for you now.", time: "10:25" },
    { from: "customer", text: "Thanks. I’ll be home after 2 pm if that helps with the delivery.", time: "10:26" },
  ],
  sofia: [
    { from: "customer", text: "Hello, I just received my Luna lamp and I’m not sure which way the shade is meant to face. Could you help?", time: "Ahora" },
  ],
};

const articles = [
  { title: "Consultar el estado de un pedido", category: "Pedidos y entregas", body: "Confirma el número de pedido y el correo del cliente en la pestaña Info. Abre Seguimiento e introduce el número de pedido. Si el transportista aún no publica movimientos, informa al cliente que el envío está pendiente de actualización; no confirmes una fecha sin información verificada." },
  { title: "Montaje de la lámpara Luna", category: "Guías de producto", body: "Desconecta la lámpara antes de comenzar. Coloca la base en una superficie plana, fija el soporte y orienta la abertura de la pantalla hacia abajo. Consulta la guía del modelo OH-LUNA-01 y solicita una fotografía si las piezas no coinciden." },
  { title: "Cambios y devoluciones", category: "Políticas de atención", body: "Verifica la fecha de compra y el estado del producto. Registra el motivo de la solicitud en Disposición y notas. Antes de ofrecer un cambio o reembolso, valida la elegibilidad con tu supervisor y comparte con el cliente los siguientes pasos confirmados." },
];

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function idleTone(seconds: number) {
  if (seconds >= 120) return "critical";
  if (seconds >= 90) return "warning";
  return "healthy";
}

export function AgentDesk() {
  const [page, setPage] = useState<"conversations" | "dashboard" | "contacts">(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    return view === "dashboard" || view === "contacts" ? view : "conversations";
  });
  const [modal, setModal] = useState<"kb" | "notifications" | "contact" | null>(null);
  const [kbSearch, setKbSearch] = useState("");
  const [articleIndex, setArticleIndex] = useState<number | null>(null);
  const [contactRole, setContactRole] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [attachment, setAttachment] = useState("");
  const [activeId, setActiveId] = useState<ChatId>("jordan");
  const [openIds, setOpenIds] = useState<ChatId[]>(["jordan", "sofia"]);
  const [started, setStarted] = useState<Record<ChatId, boolean>>({ jordan: true, sofia: false });
  const [elapsed, setElapsed] = useState<Record<ChatId, number>>({ jordan: 42, sofia: 0 });
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("info");
  const [disposition, setDisposition] = useState("Consulta de pedido");
  const [notes, setNotes] = useState("Cliente disponible después de las 14:00. Revisar actualización de transporte.");
  const [orderSearch, setOrderSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [sentState, setSentState] = useState(false);
  const activeChat = chats[activeId];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = { ...current };
        openIds.forEach((id) => {
          if (started[id]) next[id] += 1;
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [openIds, started]);

  const selectChat = (id: ChatId) => {
    if (!openIds.includes(id)) return;
    if (!started[id]) {
      setStarted((value) => ({ ...value, [id]: true }));
      setElapsed((value) => ({ ...value, [id]: 0 }));
    }
    setActiveId(id);
  };

  const closeChat = (event: React.MouseEvent, id: ChatId) => {
    event.stopPropagation();
    const remaining = openIds.filter((item) => item !== id);
    setOpenIds(remaining);
    if (remaining.length) {
      const next = remaining[0];
      if (!started[next]) {
        setStarted((value) => ({ ...value, [next]: true }));
        setElapsed((value) => ({ ...value, [next]: 0 }));
      }
      if (activeId === id) setActiveId(next);
    }
  };

  const sendMessage = () => {
    const text = draft.trim();
    if ((!text && !attachment) || !openIds.length) return;
    const stamp = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setMessages((current) => ({ ...current, [activeId]: [...current[activeId], { from: "agent", text: `${text}${attachment ? `${text ? "\n" : ""}Archivo adjunto: ${attachment}` : ""}`, time: stamp }] }));
    setDraft("");
    setAttachment("");
    setElapsed((current) => ({ ...current, [activeId]: 0 }));
    setSentState(true);
    window.setTimeout(() => setSentState(false), 1500);
  };

  return (
    <div className="orbit-desk" data-idle={idleTone(elapsed[activeId])}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .orbit-desk {
          --ink: #253a4d; --muted: #7e94a7; --line: rgba(111,145,169,.18);
          min-height: 100dvh; padding: 22px 26px 26px; color: var(--ink);
          font-family: 'DM Sans', sans-serif;
          background:
            radial-gradient(ellipse at 10% 4%, rgba(248,253,255,.86), transparent 34%),
            radial-gradient(ellipse at 86% 88%, rgba(158,207,235,.54), transparent 36%),
            linear-gradient(132deg,#cfe7f5 0%,#dceefa 46%,#c9e2f2 100%);
        }
        .orbit-shell { width: min(1500px,100%); min-height: calc(100dvh - 48px); margin: 0 auto; display:flex; flex-direction:column; }
        .topbar { height:58px; display:flex; align-items:center; justify-content:space-between; padding:0 6px 15px; }
        .brand { display:flex; align-items:center; gap:11px; font-family:Manrope,sans-serif; font-size:18px; font-weight:800; letter-spacing:-.55px; color:#244357; }
        .brand-mark { width:34px; height:34px; border-radius:12px; display:grid; place-items:center; background:#267f8e; color:white; box-shadow:0 5px 12px rgba(31,112,129,.18); }
        .brand-caption { margin-left:2px; font:600 10px 'DM Sans',sans-serif; color:#83a0b4; text-transform:uppercase; letter-spacing:1.45px; }
        .top-actions { display:flex; align-items:center; gap:12px; }
        .kb-button { display:flex; gap:8px; align-items:center; border:1px solid rgba(117,151,176,.22); background:rgba(255,255,255,.48); color:#557085; padding:9px 12px; border-radius:11px; font:600 12px 'DM Sans',sans-serif; cursor:pointer; transition:background .2s, transform .2s; }
        .kb-button:hover { background:rgba(255,255,255,.85); transform:translateY(-1px); }
        .profile { display:flex; align-items:center; gap:9px; padding-left:12px; border-left:1px solid var(--line); }
        .profile-copy { text-align:right; line-height:1.25; font-size:11px; font-weight:700; }
        .profile-copy span { display:block; color:#91a4b3; font-size:10px; font-weight:500; margin-top:2px; }
        .avatar { width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#d8ede8;color:#397c70;font-size:11px;font-weight:700;border:2px solid rgba(255,255,255,.84); }
        .tabs-row { display:flex; align-items:center; gap:11px; padding:0 2px 10px; min-height:66px; }
        .conversation-tab { position:relative; display:flex; align-items:center; gap:11px; width:294px; height:52px; min-width:0; border:1px solid rgba(117,151,176,.28); background:rgba(238,248,254,.57); backdrop-filter:blur(18px); padding:7px 12px; border-radius:15px; text-align:left; cursor:pointer; color:#6f899d; transition:background .22s,border-color .22s,box-shadow .22s,transform .22s; }
        .conversation-tab:hover { transform:translateY(-1px); }
        .conversation-tab.selected { background:rgba(250,253,255,.76); color:#304b5e; }
        .conversation-tab.edge-healthy { border-color:rgba(58,184,123,.72); box-shadow:0 0 0 1px rgba(68,196,134,.22),0 0 15px rgba(68,196,134,.16); }
        .conversation-tab.edge-warning { border-color:rgba(229,176,65,.84); box-shadow:0 0 0 1px rgba(238,188,78,.26),0 0 17px rgba(238,188,78,.25); }
        .conversation-tab.edge-critical { border-color:rgba(223,100,94,.9); box-shadow:0 0 0 1px rgba(223,100,94,.28),0 0 18px rgba(223,100,94,.29); }
        .conversation-tab.incoming { border-color:rgba(57,174,117,.64); background:rgba(237,255,245,.76); box-shadow:0 0 0 1px rgba(62,190,126,.22),0 0 18px rgba(62,190,126,.24); }
        .conversation-tab.incoming::after { content:"";position:absolute;inset:-1px;border-radius:15px;border:1px solid rgba(62,190,126,.72);box-shadow:0 0 16px rgba(62,190,126,.38);pointer-events:none;animation:incomingPulse 1.8s ease-in-out infinite; }
        @keyframes incomingPulse { 0%,100%{opacity:.2} 50%{opacity:.95} }
        .tab-avatar { flex:none; width:31px;height:31px;border-radius:11px;display:grid;place-items:center;background:#e5e0f7;color:#766ca1;font-size:11px;font-weight:700; }
        .tab-main { min-width:0; flex:1; }
        .tab-name { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:#40596b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tab-meta { display:flex; flex-direction:column; align-items:flex-end; gap:5px; }
        .idle { display:flex; align-items:center; gap:6px; padding:5px 7px; border-radius:8px; background:rgba(230,248,238,.72); font:700 10px ui-monospace,SFMono-Regular,monospace; color:#378d65; }
        .idle.warning { color:#c19132; } .idle.critical { color:#c45b56; }
        .idle.warning { background:rgba(255,246,223,.84); }
        .idle.critical { background:rgba(255,235,232,.88); }
        .idle-dot { width:7px;height:7px;border-radius:50%;background:#52bd84; box-shadow:0 0 0 3px rgba(82,189,132,.12); }
        .warning .idle-dot { background:#e4b751; box-shadow:0 0 0 3px rgba(228,183,81,.12); }
        .critical .idle-dot { background:#de6b64; box-shadow:0 0 0 3px rgba(222,107,100,.12); }
        .new-badge { color:#268c5c; background:#dff6e9; border-radius:6px; padding:5px 7px; text-transform:uppercase; letter-spacing:.7px; font-size:8px; font-weight:800; }
        .close-tab { border:0;background:transparent;color:#a1b1bc;padding:4px;display:grid;place-items:center;border-radius:6px;cursor:pointer; }
        .close-tab:hover { background:#edf2f5;color:#557085; }
        .workspace { flex:1; min-height:650px; display:grid; grid-template-columns:minmax(0,1fr) 346px; gap:17px; overflow:visible; background:transparent; }
        .chat-panel { min-width:0; display:flex; flex-direction:column; border:1px solid rgba(255,255,255,.78); border-radius:21px; background:rgba(243,250,255,.68); box-shadow:0 17px 42px rgba(55,104,132,.12),0 2px 9px rgba(55,104,132,.05); backdrop-filter:blur(26px); overflow:hidden; }
        .chat-heading { height:76px; padding:0 25px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(109,145,167,.12); }
        .customer-heading { display:flex;align-items:center;gap:12px; }
        .large-avatar { width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:#e7e1f8;color:#786fa5;font-size:12px;font-weight:700; }
        .customer-name { font:700 14px Manrope,sans-serif; color:#334d60; letter-spacing:-.25px; }
        .online { display:flex;align-items:center;gap:5px;color:#91a3b0;font-size:10px;margin-top:4px; }
        .online i { display:block;width:6px;height:6px;background:#60bb83;border-radius:50%; }
        .chat-controls { display:flex;align-items:center;gap:8px; }
        .icon-button { width:33px;height:33px;display:grid;place-items:center;border:1px solid transparent;border-radius:10px;color:#8aa0b0;background:transparent;cursor:pointer; }
        .icon-button:hover { background:#f0f6f8;color:#4d7082;border-color:#e4edf1; }
        .resolve-button { display:flex;align-items:center;gap:7px;border:1px solid #d4e9df;color:#338060;background:#eff9f3;padding:8px 11px;border-radius:9px;font-size:11px;font-weight:700;cursor:pointer; }
        .chat-context { padding:10px 25px 3px; display:flex;gap:7px; }
        .context-pill { display:inline-flex;align-items:center;gap:5px;background:#f0edf9;border:1px solid rgba(151,135,193,.12);color:#7c729e;border-radius:20px;padding:5px 9px;font-size:9px;font-weight:600; }
        .context-pill.order { background:#eef6f6;color:#548286; }
        .messages { flex:1; min-height:0; overflow:auto; padding:20px 26px 15px; display:flex;flex-direction:column;gap:15px; }
        .message-line { display:flex;align-items:flex-end;gap:9px;max-width:78%; }
        .message-line.agent { align-self:flex-end;flex-direction:row-reverse; }
        .message-avatar { flex:none;width:25px;height:25px;border-radius:9px;display:grid;place-items:center;background:#e4e0f2;color:#8077a4;font-size:8px;font-weight:700; }
        .message-line.agent .message-avatar { background:#dcece7;color:#4b8a78; }
        .message-body { min-width:0; }
        .bubble { padding:12px 14px;border-radius:15px 15px 15px 5px;background:#e8e1f7;color:#485468;font-size:12px;line-height:1.6;box-shadow:0 2px 5px rgba(61,72,102,.035); }
        .message-line.agent .bubble { background:#e8edf0;border-radius:15px 15px 5px 15px;color:#425667; }
        .message-time { margin:5px 3px 0;color:#a5b1bb;font-size:9px; }
        .message-line.agent .message-time { text-align:right; }
        .composer-wrap { padding:12px 22px 17px; }
        .composer { display:flex;align-items:flex-end;gap:8px;padding:9px 10px;border:1px solid rgba(130,158,177,.22);border-radius:14px;background:rgba(255,255,255,.77);box-shadow:0 4px 12px rgba(62,100,124,.045); }
        .composer textarea { flex:1;min-width:0;resize:none;height:38px;border:0;outline:0;background:transparent;color:#40596b;font:12px 'DM Sans',sans-serif;padding:10px 3px; }
        .composer textarea::placeholder { color:#a2b1bc; }
        .composer-actions { display:flex;align-items:center;gap:5px; }
        .send-button { width:35px;height:35px;display:grid;place-items:center;background:#277f8e;color:#fff;border:0;border-radius:11px;cursor:pointer;transition:transform .2s,background .2s; }
        .send-button:hover { background:#1f7180;transform:translateY(-1px); }
        .send-button.sent { background:#4b9e78; }
        .composer-hint { margin:7px 4px 0;color:#a2b1bc;font-size:9px; }
        .side-panel { min-width:0; display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.8);border-radius:21px;background:rgba(238,248,254,.64);box-shadow:0 17px 42px rgba(55,104,132,.1),0 2px 9px rgba(55,104,132,.04);backdrop-filter:blur(26px);overflow:hidden; }
        .side-top { display:flex;align-items:center;justify-content:space-between;padding:19px 20px 14px; }
        .side-title { font:800 10px Manrope,sans-serif;color:#7690a2;text-transform:uppercase;letter-spacing:1.5px; }
        .order-chip { font:700 10px ui-monospace,monospace;color:#7b8fa0;background:#f0f5f7;border:1px solid #e6edef;border-radius:7px;padding:5px 7px; }
        .side-tabs { display:grid;grid-template-columns:1fr 1.35fr 1.25fr;padding:0 14px;border-bottom:1px solid rgba(114,149,170,.14); }
        .side-tab { position:relative;display:flex;justify-content:center;align-items:center;gap:6px;padding:12px 3px 11px;border:0;background:transparent;color:#9aabb7;font:600 10px 'DM Sans',sans-serif;white-space:nowrap;cursor:pointer; }
        .side-tab.active { color:#367d88; }
        .side-tab.active::after { content:"";position:absolute;bottom:-1px;left:14%;right:14%;height:2px;border-radius:2px;background:#4c9e9d; }
        .side-content { padding:20px 20px;overflow:auto; }
        .section-kicker { color:#a3b2bd;text-transform:uppercase;letter-spacing:1.2px;font-size:9px;font-weight:700;margin-bottom:14px; }
        .profile-card { padding:15px;border-radius:14px;background:linear-gradient(140deg,rgba(240,248,250,.92),rgba(248,247,253,.92));border:1px solid rgba(135,162,180,.12);margin-bottom:20px; }
        .reason-card { margin:-5px 0 21px;padding:12px 13px;border:1px solid rgba(132,164,185,.16);border-radius:12px;background:rgba(233,245,251,.62); }
        .reason-label { display:block;margin-bottom:5px;color:#91a6b5;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.75px; }
        .reason-copy { color:#536e80;font-size:10px;line-height:1.5; }
        .profile-card-head { display:flex;align-items:center;gap:11px;margin-bottom:15px; }
        .profile-card .large-avatar { width:42px;height:42px; }
        .customer-tier { font-size:10px;color:#91a2ae;margin-top:4px; }
        .info-grid { display:grid;grid-template-columns:1fr 1fr;gap:13px 10px; }
        .info-item label { display:block;color:#a0aeba;font-size:9px;margin-bottom:4px; }
        .info-item span { display:block;color:#536b7d;font-size:10px;font-weight:600;overflow-wrap:anywhere; }
        .info-item.wide { grid-column:1/-1; }
        .order-summary { padding:14px 0;border-top:1px solid rgba(114,149,170,.12); }
        .summary-row { display:flex;justify-content:space-between;align-items:center;color:#8c9eac;font-size:10px;margin-bottom:9px; }
        .summary-row strong { color:#536d7d;font-weight:700; }
        .summary-status { display:flex;align-items:center;gap:6px;color:#8b9eab;font-size:10px;padding:10px;background:#f5f8f9;border-radius:9px; }
        .summary-status i { display:block;width:6px;height:6px;border-radius:50%;background:#a9bac4; }
        .field-label { display:block;color:#718999;font-size:10px;font-weight:700;margin:0 0 7px; }
        .select-wrap { position:relative;margin-bottom:19px; }
        .select-wrap select { width:100%;appearance:none;border:1px solid #e1e9ed;border-radius:10px;padding:11px 32px 11px 11px;background:#fff;color:#536b7b;font:500 11px 'DM Sans',sans-serif;outline:0; }
        .select-wrap svg { position:absolute;right:11px;top:12px;color:#98aab5;pointer-events:none; }
        .notes-area { width:100%;min-height:150px;resize:vertical;border:1px solid #e1e9ed;border-radius:11px;padding:12px;background:rgba(255,255,255,.84);font:11px/1.6 'DM Sans',sans-serif;color:#586f80;outline:0; }
        .notes-area:focus,.tracking-search:focus { border-color:#8fc2c5;box-shadow:0 0 0 3px rgba(98,168,171,.11); }
        .save-note { display:flex;align-items:center;gap:5px;margin-top:10px;color:#7c9a8e;font-size:9px; }
        .tracking-intro { color:#8fa2af;font-size:11px;line-height:1.5;margin:-5px 0 15px; }
        .tracking-search { width:100%;height:39px;padding:0 11px 0 34px;border:1px solid #e1e9ed;border-radius:10px;background:#fff;color:#536b7b;font:11px 'DM Sans',sans-serif;outline:0; }
        .search-wrap { position:relative; }
        .search-wrap svg { position:absolute;left:11px;top:12px;color:#9eafba; }
        .tracking-empty { margin-top:21px;padding:20px 14px;text-align:center;border:1px dashed #d8e4e9;border-radius:14px;background:rgba(249,252,253,.6); }
        .empty-icon { margin:0 auto 12px;width:38px;height:38px;border-radius:13px;background:#edf4f6;color:#8eaab5;display:grid;place-items:center; }
        .tracking-empty strong { display:block;color:#657e8e;font-size:11px;margin-bottom:6px; }
        .tracking-empty p { color:#99aab5;font-size:10px;line-height:1.5;margin:0; }
        .tracking-ref { display:inline-block;margin-top:12px;padding:5px 8px;border-radius:6px;background:#f0f5f7;color:#8197a5;font:10px ui-monospace,monospace; }
        .new-convo-note { display:flex;align-items:center;gap:7px;margin-top:14px;color:#88a294;font-size:9px; }
        @media (max-width: 900px) {
          .orbit-desk { padding:14px; }
          .workspace { grid-template-columns:minmax(0,1fr) 300px; gap:12px; }
          .conversation-tab { width:min(294px,48vw); }
        }
        @media (max-width: 700px) {
          .orbit-desk { padding:12px; }
          .orbit-shell { min-height:calc(100dvh - 24px); }
          .brand-caption,.profile-copy,.kb-button span { display:none; }
          .topbar { height:52px;padding-bottom:10px; }
          .tabs-row { min-height:60px;gap:7px;overflow:auto; }
          .conversation-tab { width:calc(50vw - 18px);height:50px;min-width:190px;padding:7px 9px;gap:7px; }
          .tab-sub { max-width:90px; }
          .workspace { min-height:calc(100dvh - 139px);display:flex;flex-direction:column;gap:12px;overflow:visible; }
          .chat-panel { min-height:540px; }
          .side-panel { min-height:310px; }
          .chat-heading { padding:0 14px;height:68px; }
          .messages { padding:16px 14px; }
          .message-line { max-width:92%; }
          .chat-context { padding:9px 14px 1px; }
          .composer-wrap { padding:10px 12px 14px; }
          .side-content { padding:16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          *,*::before,*::after { animation-duration:.01ms !important;animation-iteration-count:1 !important;scroll-behavior:auto !important;transition-duration:.01ms !important; }
        }
        /* Night-glass direction: browser-like tabs above floating glass panels. */
        .orbit-desk {
          --ink:#f2efff; --muted:#b7accd; --line:rgba(235,226,255,.18);
          color:var(--ink);
          background:
            radial-gradient(ellipse at 82% 28%,rgba(147,76,157,.42),transparent 44%),
            radial-gradient(ellipse at 12% 88%,rgba(83,70,128,.28),transparent 42%),
            linear-gradient(115deg,#111a2b 0%,#1b1a31 43%,#31223f 72%,#50345c 100%);
        }
        .brand { color:#f4efff; }
        .brand-mark { background:linear-gradient(145deg,#937cc2,#66578f);box-shadow:0 7px 20px rgba(9,5,22,.32),inset 0 1px rgba(255,255,255,.28); }
        .brand-caption,.profile-copy span { color:#b4a9c9; }
        .kb-button { border-color:rgba(237,228,255,.2);background:rgba(238,229,255,.09);color:#e8e0f7;backdrop-filter:blur(18px); }
        .kb-button:hover { background:rgba(238,229,255,.17); }
        .profile { border-left-color:rgba(237,228,255,.16); }
        .profile-copy { color:#f0eafb; }
        .avatar { background:rgba(184,218,210,.2);color:#c8f0df;border-color:rgba(255,255,255,.32); }
        .tabs-row {
          width:calc((100% - 17px) * .6);
          min-height:58px;align-items:flex-end;gap:0;padding:8px 0 0;
          position:relative;z-index:2;margin-bottom:-1px;
          border:1px solid rgba(235,225,255,.14);border-bottom-color:rgba(235,225,255,.18);
          border-radius:16px 16px 0 0;background:rgba(10,12,25,.2);
          box-shadow:inset 0 1px rgba(255,255,255,.06);
        }
        .conversation-tab {
          height:47px;border-radius:12px 12px 0 0;
          border-color:rgba(231,220,255,.2);border-bottom-color:rgba(231,220,255,.12);
          background:rgba(107,89,145,.16);color:#cec4e0;
          box-shadow:inset 0 1px rgba(255,255,255,.09);
          backdrop-filter:blur(22px) saturate(155%);
          transform:translateY(-3px);
          transition:transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease;
        }
        .conversation-tab + .conversation-tab {
          margin-left:-1px;
          border-left-color:rgba(235,225,255,.18);
        }
        .conversation-tab:hover { background:rgba(131,113,171,.28); }
        .conversation-tab.selected {
          z-index:2;transform:translateY(0);
          color:#f4efff;background:rgba(117,101,151,.17);
          border-color:rgba(239,231,255,.3);border-bottom-color:transparent;
          box-shadow:inset 0 1px rgba(255,255,255,.16),0 -3px 20px rgba(171,145,222,.08);
        }
        .conversation-tab.edge-healthy { border-color:rgba(75,225,155,.82);box-shadow:0 0 0 1px rgba(75,225,155,.25),0 0 18px rgba(75,225,155,.25),inset 0 1px rgba(255,255,255,.13); }
        .conversation-tab.edge-warning { border-color:rgba(255,210,99,.9);box-shadow:0 0 0 1px rgba(255,210,99,.3),0 0 20px rgba(255,210,99,.28),inset 0 1px rgba(255,255,255,.13); }
        .conversation-tab.edge-critical { border-color:rgba(255,116,130,.94);box-shadow:0 0 0 1px rgba(255,116,130,.32),0 0 22px rgba(255,90,119,.31),inset 0 1px rgba(255,255,255,.13); }
        .conversation-tab.incoming { background:rgba(57,151,112,.2);border-color:rgba(105,244,173,.76);color:#effff6;box-shadow:0 0 0 1px rgba(105,244,173,.24),0 0 20px rgba(83,242,163,.28),inset 0 1px rgba(255,255,255,.16); }
        .conversation-tab.incoming::after { inset:0;border-radius:12px 12px 0 0;border-color:rgba(111,255,181,.85);box-shadow:0 0 20px rgba(89,255,168,.46); }
        .conversation-tab.selected::before { content:none; }
        /* Chrome-style shoulders: the selected silhouette opens into the chat,
           rather than drawing a closed rectangular outline around the tab. */
        .orbit-desk { --chrome-surface:#2c3b43; --active-led:#74e9ad; }
        .orbit-desk[data-idle="warning"] { --chrome-surface:#413b38; --active-led:#ffd263; }
        .orbit-desk[data-idle="critical"] { --chrome-surface:#42313f; --active-led:#ff7482; }
        .tabs-row {
          --tab-width:294px;
          --active-cut-start:calc(var(--active-tab-index) * (var(--tab-width) - 12px) + 12px);
          --active-cut-end:calc(var(--active-cut-start) + var(--tab-width) - 24px);
          padding:8px 0 0;border-bottom:0;overflow:visible;
        }
        .tabs-row::after {
          content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;
          background:linear-gradient(to right,
            var(--active-led) 0 var(--active-cut-start),
            transparent var(--active-cut-start) var(--active-cut-end),
            var(--active-led) var(--active-cut-end) 100%);
          pointer-events:none;z-index:0;opacity:.64;
          box-shadow:none;filter:drop-shadow(0 0 3px var(--active-led));
        }
        .tabs-row .conversation-tab {
          height:48px;padding:7px 24px;isolation:isolate;flex:0 0 var(--tab-width);
          border:0;border-radius:0;background:none;box-shadow:none;
          backdrop-filter:none;transform:none;
          --tab-led:#74e9ad;
          transition:color .16s ease;
        }
        .tabs-row .conversation-tab + .conversation-tab { margin-left:-12px; }
        .tabs-row .conversation-tab.selected { z-index:3; }
        .tabs-row .conversation-tab.edge-warning { --tab-led:#ffd263; }
        .tabs-row .conversation-tab.edge-critical { --tab-led:#ff7482; }
        .tabs-row .conversation-tab::before,
        .tabs-row .conversation-tab::after { content:none; }
        .tabs-row .conversation-tab.selected::before {
          content:"";position:absolute;left:12px;right:12px;bottom:-2px;height:3px;
          background:var(--chrome-surface);pointer-events:none;z-index:0;
        }
        .chrome-tab-shape {
          position:absolute;inset:0 0 -1px;width:100%;height:calc(100% + 1px);
          overflow:visible;z-index:-1;pointer-events:none;
        }
        .chrome-tab-fill { fill:rgba(171,155,204,.09);transition:fill .18s ease; }
        .conversation-tab:hover .chrome-tab-fill { fill:rgba(171,155,204,.17); }
        .conversation-tab.selected .chrome-tab-fill { fill:var(--chrome-surface); }
        .chrome-tab-edge {
          fill:none;stroke:var(--tab-led);stroke-width:1;
          opacity:.45;filter:drop-shadow(0 -1px 3px var(--tab-led));
          transition:stroke .2s ease,opacity .18s ease;
        }
        .conversation-tab.selected .chrome-tab-edge { opacity:.85; }
        .conversation-tab.incoming .chrome-tab-fill { fill:rgba(57,151,112,.14); }
        .conversation-tab.incoming .chrome-tab-edge { animation:incomingPulse 1.8s ease-in-out infinite; }
        .chat-panel { border-top:0 !important;box-shadow:0 22px 54px rgba(8,5,20,.25) !important; }
        .chat-panel .chat-heading {
          height:44px;min-height:44px;padding:0 22px;justify-content:flex-end;
          border-bottom:0;
          background:linear-gradient(to bottom,var(--chrome-surface) 0%,var(--chrome-surface) 45%,transparent 100%);
        }
        @media (prefers-reduced-motion:reduce) {
          .conversation-tab.incoming .chrome-tab-edge { animation:none;opacity:.85; }
        }
        .workspace { grid-template-columns:minmax(0,3fr) minmax(360px,2fr);gap:17px; }
        .chat-panel { border-radius:0 0 21px 21px; }
        .messages { animation:orbit-chat-arrive .24s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes orbit-chat-arrive {
          from { opacity:0;transform:translateY(7px); }
          to { opacity:1;transform:translateY(0); }
        }
        .tab-name { color:#f0eafb; }
        .tab-avatar,.large-avatar { background:rgba(197,180,239,.22);color:#e4d8ff;border:1px solid rgba(239,229,255,.14); }
        .idle { background:rgba(91,193,137,.15);color:#a8f1c7; }
        .idle.warning { background:rgba(226,178,75,.16);color:#ffe29c; }
        .idle.critical { background:rgba(225,94,112,.17);color:#ffb0ba; }
        .idle-dot { box-shadow:0 0 8px rgba(82,255,156,.82); }
        .warning .idle-dot { box-shadow:0 0 9px rgba(255,207,86,.8); }
        .critical .idle-dot { box-shadow:0 0 9px rgba(255,97,119,.86); }
        .new-badge { color:#b8ffd6;background:rgba(55,164,105,.22);border:1px solid rgba(137,255,185,.16); }
        .close-tab { color:#c1b5d4; }
        .close-tab:hover { color:#fff;background:rgba(255,255,255,.12); }
        .chat-panel,.side-panel {
          border-color:rgba(238,228,255,.28);
          background:rgba(117,101,151,.17);
          box-shadow:0 22px 54px rgba(8,5,20,.25),inset 0 1px rgba(255,255,255,.13);
          backdrop-filter:blur(30px) saturate(155%);
        }
        .side-tabs { border-color:rgba(235,225,255,.13); }
        .customer-name { color:#f5f0ff; }
        .online { color:#c0b7d1; }
        .online i { background:#79e2a6;box-shadow:0 0 8px rgba(97,237,155,.58); }
        .icon-button { color:#c2b6d4; }
        .icon-button:hover { color:#fff;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.12); }
        .resolve-button { color:#c7f5d8;background:rgba(76,159,112,.18);border-color:rgba(135,231,166,.28); }
        .context-pill { color:#e1d4ff;background:rgba(157,132,207,.18);border-color:rgba(216,197,255,.15); }
        .context-pill.order { color:#c0e8e5;background:rgba(96,164,166,.16); }
        .message-avatar { background:rgba(194,175,237,.22);color:#e0d3ff; }
        .message-line.agent .message-avatar { background:rgba(151,209,186,.2);color:#c3f2df; }
        .bubble {
          color:#f5f0ff;background:rgba(161,139,207,.27);
          border:1px solid rgba(226,214,255,.19);
          box-shadow:inset 0 1px rgba(255,255,255,.12),0 8px 22px rgba(9,6,22,.13);
          backdrop-filter:blur(18px) saturate(155%);
        }
        .message-line.agent .bubble {
          color:#f0effb;background:rgba(211,211,235,.14);
          border-color:rgba(239,237,255,.17);
          box-shadow:inset 0 1px rgba(255,255,255,.11),0 8px 22px rgba(9,6,22,.1);
        }
        .message-time,.composer-hint { color:#b7accb; }
        .composer { border-color:rgba(236,226,255,.2);background:rgba(241,234,255,.1);box-shadow:inset 0 1px rgba(255,255,255,.11),0 8px 24px rgba(9,6,22,.12);backdrop-filter:blur(20px); }
        .composer textarea { color:#f4efff; }
        .composer textarea::placeholder { color:#b8accb; }
        .send-button { background:linear-gradient(145deg,#8f79be,#6c5a9a);box-shadow:0 5px 14px rgba(12,8,28,.2); }
        .send-button:hover { background:#9b85cb; }
        .side-title,.section-kicker { color:#c2b6d4; }
        .order-chip { color:#e4dcf2;background:rgba(255,255,255,.09);border-color:rgba(236,226,255,.16); }
        .side-tab { color:#c0b4d1; }
        .side-tab.active { color:#eee3ff; }
        .side-tab.active::after { background:#c3a9ff;box-shadow:0 0 10px rgba(193,165,255,.64); }
        .profile-card { background:linear-gradient(140deg,rgba(224,214,255,.11),rgba(181,163,220,.08));border-color:rgba(239,230,255,.15);box-shadow:inset 0 1px rgba(255,255,255,.09); }
        .reason-card { background:rgba(183,163,224,.1);border-color:rgba(235,222,255,.16); }
        .reason-label,.info-item label { color:#c0b4d1; }
        .reason-copy,.info-item span { color:#eee8fa; }
        .customer-tier,.summary-row { color:#c2b7d2; }
        .summary-row strong { color:#eee8fa; }
        .summary-status { color:#d0c6df;background:rgba(255,255,255,.08); }
        .summary-status i { background:#8ba99a; }
        .order-summary { border-color:rgba(235,225,255,.13); }
        .field-label { color:#e0d7ed; }
        .select-wrap select,.notes-area,.tracking-search {
          color:#f1ebfb;background:rgba(244,238,255,.1);
          border-color:rgba(235,225,255,.2);
        }
        .select-wrap select option { color:#2d2540;background:#eee8f6; }
        .notes-area::placeholder,.tracking-search::placeholder { color:#b8accb; }
        .select-wrap svg,.search-wrap svg { color:#c0b4d2; }
        .save-note,.tracking-intro,.new-convo-note { color:#c1b6d0; }
        .tracking-empty { background:rgba(233,224,255,.07);border-color:rgba(235,225,255,.22); }
        .empty-icon { color:#e0d5f4;background:rgba(215,200,247,.13); }
        .tracking-empty strong { color:#eee8f7; }
        .tracking-empty p { color:#c0b5d1; }
        .tracking-ref { color:#e1d8f0;background:rgba(255,255,255,.09); }
        @media (max-width:700px) {
          .tabs-row { --tab-width:max(190px,calc(50vw - 18px));width:100%;gap:0; }
          .conversation-tab { height:44px;border-radius:11px 11px 0 0; }
          .conversation-tab.incoming::after { border-radius:11px 11px 0 0; }
          .chat-panel { border-radius:0 0 21px 21px; }
        }
        @media (max-width:900px) and (min-width:701px) {
          .workspace { grid-template-columns:minmax(0,3fr) minmax(300px,2fr);gap:12px; }
          .tabs-row { width:calc((100% - 12px) * .6); }
        }
        @media (prefers-reduced-motion:reduce) {
          .conversation-tab.incoming::after { animation:none; }
        }
      `}</style>
      <div className="orbit-shell">
        <aside className="app-sidebar" aria-label="Navegación principal">
          <div className="sidebar-logo" title="Orbit Home"><MessageCircle size={24} /></div>
          <nav className="sidebar-nav">
            <button type="button" className={`nav-item ${page === "dashboard" ? "active" : ""}`} onClick={() => setPage("dashboard")}><LayoutDashboard size={23} /><span>Dashboard</span></button>
            <button type="button" className={`nav-item ${page === "contacts" ? "active" : ""}`} onClick={() => setPage("contacts")}><Users size={23} /><span>Contactos</span></button>
            <button type="button" className={`nav-item ${page === "conversations" ? "active" : ""}`} onClick={() => setPage("conversations")}><MessageCircle size={23} /><span>Conversations</span></button>
          </nav>
          <button type="button" className="nav-item kb-nav" onClick={() => { setModal("kb"); setArticleIndex(null); }}><BookOpen size={23} /><span>KB</span></button>
        </aside>
        <div className="app-main">
        <header className="topbar">
          <div className="page-brand"><strong>Chat Support</strong><span>Orbit Home</span></div>
          <div className="top-actions">
            <button className="notification-button" type="button" aria-label="Ver notificaciones" onClick={() => setModal("notifications")}><Bell size={21} /><i /></button>
            <div className="profile">
              <div className="profile-copy">Camila Torres<span>Agente de soporte</span></div>
              <div className="avatar">CT</div>
            </div>
          </div>
        </header>

        {page === "dashboard" && <section className="route-page">
          <div className="route-header"><div><div className="route-eyebrow">Tu desempeño</div><h1 className="route-title">Buen trabajo, Camila.</h1><p className="route-intro">Una mirada a la atención que brindas cada día.</p></div><span className="date-chip">01 — 23 octubre, 2026 · Demo</span></div>
          <div className="metric-grid">
            <div className="metric-card hero"><div className="metric-label">Net Promoter Score <Sparkles size={18} /></div><div><div className="metric-value">+72</div><p className="metric-note">↑ 6 puntos frente al mes anterior</p><p className="route-intro">Basado en 136 respuestas de clientes</p></div><div className="metric-bottom"><span>Promotores<br /><strong>79.4%</strong></span><span>Pasivos<br /><strong>13.2%</strong></span><span>Detractores<br /><strong>7.4%</strong></span></div></div>
            <div className="metric-card"><div className="metric-label">Chats atendidos <MessageCircle size={18} /></div><div className="metric-value">247</div><span className="metric-note">↑ 23 chats respecto al mes anterior</span></div>
            <div className="metric-card"><div className="metric-label">First call resolution <Check size={18} /></div><div className="metric-value">86.2<span style={{fontSize:24}}>%</span></div><span className="metric-note">Resueltos desde el primer contacto</span></div>
          </div>
          <div className="month-card"><div className="metric-label">Closed ticket rate · este mes <BarChart3 size={18} /></div><div className="metric-value">91.8<span style={{fontSize:24}}>%</span></div><p className="route-intro">224 de 244 tickets cerrados · Objetivo mensual: 90%</p><div className="bar-chart">{[61,73,69,87,78,94,91].map((height,index)=><div className="chart-column" key={index}><i style={{height:`${height}%`}} /><small>{17+index} oct</small></div>)}</div></div>
        </section>}
        {page === "contacts" && <section className="route-page">
          <div className="route-header"><div><div className="route-eyebrow">Tu equipo de apoyo</div><h1 className="route-title">Contactos</h1><p className="route-intro">La persona indicada para cada consulta.</p></div><span className="date-chip">4 contactos internos</span></div>
          <div className="contacts-list">{[
            {role:"Supervisor",name:"Lucía Mendoza",initials:"LM",detail:"Escalaciones y asistencia en vivo"},
            {role:"Manager",name:"Andrés Vidal",initials:"AV",detail:"Operaciones y desempeño del equipo"},
            {role:"QA",name:"Valeria Ríos",initials:"VR",detail:"Calidad de atención y evaluaciones"},
            {role:"HR",name:"Daniela Cruz",initials:"DC",detail:"Personas, horarios y bienestar"},
          ].map(contact=><div className="contact-card" key={contact.role}><div className="contact-card-top"><div className="large-avatar">{contact.initials}</div><div><strong>{contact.role}</strong><p>{contact.name}</p></div></div><p style={{marginBottom:20}}>{contact.detail}</p><button className="contact-action" type="button" onClick={()=>{setContactRole(contact.role);setContactMessage("");setContactSent(false);setModal("contact");}}><MessageCircle size={13} />Escribir mensaje</button></div>)}</div>
        </section>}
        {page === "conversations" && <div className="conversation-layout">
        <aside className="recent-panel">
          <div className="recent-heading">Conversaciones <MessageCircle size={14} /></div>
          <div className="recent-subtitle">Chats abiertos ({openIds.length})</div>
          {openIds.map(id=><button type="button" key={id} className={`recent-card ${idleTone(elapsed[id])} ${activeId===id?"selected":""} ${!started[id]?"incoming":""}`} onClick={()=>selectChat(id)} aria-pressed={activeId===id} aria-label={`${chats[id].name}, ${!started[id]?"chat nuevo":`${formatTime(elapsed[id])} sin respuesta${elapsed[id]>=120?", requiere atención":""}`}`}><span className="recent-card-head"><strong>{chats[id].name}</strong><small>{started[id]?formatTime(elapsed[id]):"Nuevo"}</small></span><p>{messages[id][messages[id].length-1].text}</p></button>)}
          {!openIds.length && <p className="route-intro">No tienes chats activos.</p>}
          <div className="capacity"><label>Capacidad de atención <span>{openIds.length} / 2</span></label><div className="capacity-bar"><i style={{width:`${openIds.length*50}%`}} /></div></div>
        </aside>
        <div className="desk-body">
        <main className="workspace">
          <section className="chat-panel" aria-label={`Conversación con ${activeChat.name}`}>
            {!openIds.length ? <div className="empty-chat"><MessageCircle size={36} /><h3>Todo al día.</h3><p>Has finalizado tus conversaciones. Los próximos chats aparecerán en la lista de la izquierda.</p><button type="button" className="contact-action" onClick={()=>{setOpenIds(["jordan","sofia"]);setStarted({jordan:true,sofia:false});setElapsed({jordan:0,sofia:0});setActiveId("jordan");}}>Reiniciar demostración</button></div> : <>
            <div className="chat-context">
              <span className="context-pill"><Sparkles size={11} />Cliente recurrente</span>
              <span className="context-pill order"><Box size={11} />Pedido {activeChat.order}</span>
              <button className="resolve-button" type="button" onClick={(event) => closeChat(event, activeId)}><X size={13} />End chat</button>
            </div>
            <div className="messages" key={activeId}>
              {messages[activeId].map((message, index) => (
                <div className={`message-line ${message.from}`} key={`${activeId}-${index}`}>
                  <div className="message-avatar">{message.from === "agent" ? "CT" : activeChat.initials}</div>
                  <div className="message-body">
                    <div className="bubble">{message.text}</div>
                    <div className="message-time">{message.time}{message.from === "agent" && index === messages[activeId].length - 1 ? " · Enviado" : ""}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="composer-wrap">
              <div className="composer">
                <label className="icon-button" title="Adjuntar archivo" style={{cursor:"pointer"}}><Paperclip size={16} /><input type="file" style={{display:"none"}} onChange={event=>setAttachment(event.target.files?.[0]?.name || "")} aria-label="Adjuntar archivo" /></label>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Escribe una respuesta…" aria-label="Escribe una respuesta" />
                <div className="composer-actions">
                  <button className={`send-button ${sentState ? "sent" : ""}`} type="button" onClick={sendMessage} aria-label="Enviar mensaje">{sentState ? <Check size={16} /> : <Send size={15} />}</button>
                </div>
              </div>
              <div className="composer-hint">{attachment ? `Adjunto: ${attachment}` : "Pulsa Intro para enviar · Mayús + Intro para nueva línea"}</div>
            </div>
            </>}
          </section>

          <aside className="side-panel">
            <div className="side-top"><span className="side-title">Espacio del cliente</span><span className="order-chip">{activeChat.order}</span></div>
            <div className="side-tabs" role="tablist" aria-label="Herramientas del cliente">
              <button type="button" role="tab" aria-selected={workspaceTab === "info"} className={`side-tab ${workspaceTab === "info" ? "active" : ""}`} onClick={() => setWorkspaceTab("info")}><CircleHelp size={13} />Info</button>
              <button type="button" role="tab" aria-selected={workspaceTab === "notes"} className={`side-tab ${workspaceTab === "notes" ? "active" : ""}`} onClick={() => setWorkspaceTab("notes")}><FileText size={13} />Disposición y notas</button>
              <button type="button" role="tab" aria-selected={workspaceTab === "order"} className={`side-tab ${workspaceTab === "order" ? "active" : ""}`} onClick={() => setWorkspaceTab("order")}><Box size={13} />Seguimiento</button>
            </div>
            <div className="side-content">
              {workspaceTab === "info" && (
                <>
                  <div className="section-kicker">Perfil del cliente</div>
                  <div className="profile-card">
                    <div className="profile-card-head"><div className="large-avatar">{activeChat.initials}</div><div><div className="customer-name">{activeChat.name}</div><div className="customer-tier">Cliente Orbit Home</div></div></div>
                    <div className="info-grid">
                      <div className="info-item"><label>Modelo</label><span>{activeChat.model}</span></div>
                      <div className="info-item"><label>Pedido</label><span>{activeChat.order}</span></div>
                      <div className="info-item wide"><label>Teléfono</label><span>{activeChat.phone}</span></div>
                      <div className="info-item wide"><label>Correo electrónico</label><span>{activeChat.email}</span></div>
                    </div>
                  </div>
                  <div className="reason-card">
                    <span className="reason-label">Motivo de consulta</span>
                    <div className="reason-copy">{activeChat.intro}</div>
                  </div>
                  <div className="section-kicker">Relación con Orbit</div>
                  <div className="summary-status"><i />{activeChat.tenure}</div>
                  <div className="order-summary">
                    <div className="summary-row"><span>Producto</span><strong>{activeChat.model}</strong></div>
                    <div className="summary-row"><span>Canal de contacto</span><strong>Chat web</strong></div>
                  </div>
                </>
              )}
              {workspaceTab === "notes" && (
                <>
                  <div className="section-kicker">Resultado de la atención</div>
                  <label className="field-label" htmlFor="disposition">Disposición de llamada</label>
                  <div className="select-wrap">
                    <select id="disposition" value={disposition} onChange={(event) => setDisposition(event.target.value)}>
                      <option>Consulta de pedido</option><option>Información de producto</option><option>Problema de entrega</option><option>Devolución o cambio</option><option>Seguimiento requerido</option>
                    </select><ChevronDown size={14} />
                  </div>
                  <label className="field-label" htmlFor="agent-notes">Notas internas</label>
                  <textarea id="agent-notes" className="notes-area" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Añade contexto para el siguiente agente…" />
                  <div className="save-note"><Check size={12} />Notas en esta sesión · demostración</div>
                </>
              )}
              {workspaceTab === "order" && (
                <>
                  <div className="section-kicker">Estado del pedido</div>
                  <p className="tracking-intro">Busca el pedido para consultar la información de seguimiento disponible.</p>
                  <div className="search-wrap"><Search size={14} /><input className="tracking-search" aria-label="Buscar número de pedido" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Número de pedido" /></div>
                  <div className="tracking-empty">
                    <div className="empty-icon"><Box size={18} /></div>
                    <strong>No hay actualización de tránsito</strong>
                    <p>Aún no hay una actualización de seguimiento disponible para este pedido.</p>
                    <span className="tracking-ref">{orderSearch.trim() || activeChat.order}</span>
                  </div>
                  <div className="new-convo-note"><Clock3 size={12} />La información se actualizará cuando esté disponible.</div>
                </>
              )}
            </div>
          </aside>
        </main>
        </div>
        </div>}
        </div>
      </div>
      {modal && <div className="modal-backdrop" onClick={()=>setModal(null)}><section className="desk-modal" role="dialog" aria-modal="true" aria-label={modal==="kb"?"Base de conocimiento":modal==="contact"?`Mensaje a ${contactRole}`:"Notificaciones"} onClick={event=>event.stopPropagation()}>
        <div className="modal-head"><h2>{modal==="kb"?"Base de conocimiento":modal==="contact"?contactRole:"Notificaciones"}</h2><button className="icon-button" type="button" aria-label="Cerrar ventana" onClick={()=>setModal(null)}><X size={19} /></button></div>
        {modal==="kb" && (articleIndex===null ? <><p className="route-intro" style={{marginBottom:18}}>Respuestas y guías para acompañar cada conversación.</p><input autoFocus className="modal-search" value={kbSearch} onChange={event=>setKbSearch(event.target.value)} placeholder="Buscar artículos, productos o pedidos…" aria-label="Buscar en KB" />{articles.map((article,index)=>({...article,index})).filter(article=>`${article.title} ${article.category}`.toLowerCase().includes(kbSearch.toLowerCase())).map(article=><button type="button" className="kb-article" key={article.index} onClick={()=>setArticleIndex(article.index)}><small>{article.category}</small>{article.title}</button>)}{!articles.some(article=>`${article.title} ${article.category}`.toLowerCase().includes(kbSearch.toLowerCase()))&&<div className="tracking-empty"><strong>Sin artículos para esta búsqueda</strong><p>Prueba con “pedido”, “Luna” o “devoluciones”.</p></div>}</> : <><button type="button" className="contact-action" onClick={()=>setArticleIndex(null)}>Volver a los artículos</button><h3 style={{marginTop:24}}>{articles[articleIndex].title}</h3><p className="article-copy">{articles[articleIndex].body}</p><p className="route-intro">Artículo de ejemplo · Orbit Home KB</p></>)}
        {modal==="notifications" && <><p className="route-intro">Actualizaciones de tu espacio de trabajo</p><div className="notice">Nueva conversación de Sofia Chen<small>En espera de tu primera respuesta · Ahora</small></div><div className="notice">Tu resumen mensual está disponible<small>Consulta tus indicadores desde Dashboard · Hoy</small></div></>}
        {modal==="contact" && (contactSent?<div className="empty-chat"><Check size={32} /><h3>Mensaje preparado</h3><p>Esta es una demostración. El envío al equipo estará disponible al conectar la mensajería interna.</p></div>:<><p className="route-intro" style={{marginBottom:18}}>Redacta una consulta para {contactRole}. Vista previa de mensajería interna.</p><textarea className="notes-area" aria-label="Mensaje interno" value={contactMessage} onChange={event=>setContactMessage(event.target.value)} placeholder="¿En qué necesitas ayuda?" /><button type="button" className="contact-action" style={{marginTop:14,opacity:contactMessage.trim()?1:.5}} disabled={!contactMessage.trim()} onClick={()=>setContactSent(true)}><Send size={13} />Preparar mensaje</button></>)}
      </section></div>}
    </div>
  );
}

export default AgentDesk;
