import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import type { Message } from "@workspace/api-client-react";

export function Logo() {
  return <svg className="orbit-chat-mark" viewBox="0 0 48 48" fill="none" role="img" aria-label="Orbit Home · Chat"><defs><linearGradient id="orbit-envelope-flap" x1="7" y1="8" x2="35" y2="26" gradientUnits="userSpaceOnUse"><stop stopColor="#3ABAAE"/><stop offset="1" stopColor="#527EC3"/></linearGradient><linearGradient id="orbit-envelope-body" x1="8" y1="39" x2="40" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#319F9A"/><stop offset="1" stopColor="#4F75B5"/></linearGradient></defs><path d="M9 8h27c1.4 0 2.3.4 3.1 1.2L22.4 25.7 6 13.4V11a3 3 0 0 1 3-3Z" fill="url(#orbit-envelope-flap)"/><path d="M6 19.1 19.6 29.3 6 39.2V19.1Z" fill="#35B5A5"/><path d="M10 42c-1.4 0-2.4-.4-3.2-1.2L23.2 29l17.8-17v26a4 4 0 0 1-4 4H10Z" fill="url(#orbit-envelope-body)"/><path d="m35.8 9.8 4.3-4.3a2.5 2.5 0 0 1 3.5 3.5l-4.3 4.3Z" fill="#C6A15B"/></svg>;
}
export const initials = (name: string) => name.split(" ").filter(Boolean).map(x => x[0]).slice(0, 2).join("").toUpperCase();
export function useClock() { const [now, setNow] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []); return now; }
export function elapsed(since: string | null, now: number) { return since ? Math.max(0, Math.floor((now - Date.parse(since)) / 1000)) : 0; }
export function tone(seconds: number) { return seconds >= 120 ? "critical" : seconds >= 90 ? "warning" : "healthy"; }
export function duration(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2,"0")}:${(seconds % 60).toString().padStart(2,"0")}`; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty-chat"><MessageCircle size={34}/><h3>{title}</h3>{children}</div>; }
export function Loading() { return <div aria-label="Cargando espacio" aria-busy="true"><div className="skeleton"/><div className="skeleton tall"/></div>; }
export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} className="modal-backdrop" onCancel={close} style={{ width:"100%",height:"100%",maxWidth:"none",maxHeight:"none",margin:0,border:0,color:"inherit" }} onClick={e=>{if(e.target===e.currentTarget)close();}}><section className="desk-modal"><div className="modal-head"><h2>{title}</h2><button data-testid="button-close-dialog" className="icon-button" aria-label="Cerrar ventana" onClick={close}><X size={19}/></button></div>{children}</section></dialog>;
}
export function Messages({ messages, customer, agent }: { messages: Message[]; customer: string; agent: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block:"nearest" }); }, [messages.length]);
  return <div className="messages" aria-live="polite">{messages.map(m=><div data-testid={`message-${m.id}`} className={`message-line ${m.from}`} key={m.id}><div className="message-avatar">{initials(m.from==="customer"?customer:agent)}</div><div className="message-body"><div className="bubble">{m.text}</div><div className="message-time">{new Date(m.createdAt).toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}{m.from==="agent"?" · Enviado":""}</div></div></div>)}<div ref={end}/></div>;
}
export function Composer({ send, pending, disabled, draft, onDraftChange }: { send: (text:string)=>Promise<unknown>; pending:boolean; disabled?:boolean; draft?:string; onDraftChange?:(text:string)=>void }) {
  const [localText,setLocalText]=useState("");
  const text=draft??localText;
  const setText=onDraftChange??setLocalText;
  async function submit() { if(!text.trim()||pending||disabled)return;try{await send(text.trim());setText("");}catch{/* Parent renders the API error; preserve draft. */} }
  return <div className="composer-wrap"><div className="composer"><textarea data-testid="input-message" value={text} maxLength={5000} disabled={disabled||pending} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit();}}} aria-label="Escribe un mensaje" placeholder="Escribe una respuesta…"/><button data-testid="button-send-message" className="send-button" disabled={pending||disabled||!text.trim()} aria-label="Enviar mensaje" onClick={()=>void submit()}><Send size={15}/></button></div><div className="composer-hint">Pulsa Intro para enviar · Mayús + Intro para nueva línea</div></div>;
}
