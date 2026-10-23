import { useEffect, useState } from "react";
import { Box, CircleHelp, FileText, Search } from "lucide-react";
import type { Conversation, Customer, OrbitState } from "@workspace/api-client-react";
import type { OrbitAction } from "@/hooks/use-orbit";
import { errorText } from "@/hooks/use-orbit";
import { initials, Modal } from "./shared";
import { OrderEditor, orderStatusLabel } from "./resources";

export const categories: Record<string,string[]> = {
  "Customer Service":["Estado del pedido","Entrega y transporte","Cambio o devolución","Facturación y pagos","Actualización de datos"],
  "Tech Support":["Instalación y montaje","Configuración del producto","Problema de funcionamiento","Conectividad","Garantía y reparación"],
  Sales:["Información de producto","Disponibilidad","Cotización","Nueva compra","Accesorios y complementos"],
  Retention:["Solicitud de cancelación","Insatisfacción con el producto","Oferta de permanencia","Seguimiento de satisfacción"],
};
const customerLabels:Record<keyof Customer,string>={name:"Nombre",email:"Correo electrónico",phone:"Teléfono",model:"Modelo",orderNumber:"Pedido",since:"Cliente desde"};
export function CustomerForm({ customer, save, pending }: {customer:Customer;save:(customer:Customer)=>Promise<unknown>;pending:boolean}) {
  const [value,setValue]=useState(customer);
  const [error,setError]=useState("");
  return <form className="form-stack" onSubmit={async e=>{e.preventDefault();setError("");try{await save(value);}catch(e){setError(errorText(e));}}}>{(Object.keys(customerLabels) as (keyof Customer)[]).map(key=><label key={key}>{customerLabels[key]}<input disabled={pending} data-testid={`input-customer-${key}`} type={key==="email"?"email":"text"} value={value[key]} required={key==="name"} maxLength={300} onChange={e=>setValue({...value,[key]:e.target.value})}/></label>)}{error&&<p role="alert" className="muted-copy">{error}</p>}<button className="contact-action" disabled={pending} data-testid="button-save-customer">Guardar datos</button></form>;
}
function Notes({ conversation:c,act,pending,editable }: {conversation:Conversation;act:OrbitAction;pending:boolean;editable:boolean}) {
  // Mounted per conversation ID, never re-initialized by polling. Draft and version
  // survive failed saves, including 409s.
  const [draft,setDraft]=useState({category:c.category,subcategory:c.subcategory,notes:c.notes,version:c.version});
  const [dirty,setDirty]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const [conflict,setConflict]=useState(false);
  useEffect(()=>{
    if(!dirty&&draft.version!==c.version) {
      setDraft({category:c.category,subcategory:c.subcategory,notes:c.notes,version:c.version});
    }
  },[c.version,c.category,c.subcategory,c.notes,dirty,draft.version]);
  async function save() {
    setError("");setSaved(false);
    try{const next=await act({action:"saveNotes",id:c.id,...draft});const updated=next.conversations.find(x=>x.id===c.id);if(updated)setDraft(d=>({...d,version:updated.version}));setDirty(false);setSaved(true);setConflict(false);}
    catch(e){setError(errorText(e));setConflict(!!(e&&typeof e==="object"&&"status" in e&&e.status===409));}
  }
  return <><div className="section-kicker">Resultado de la atención</div><p className="disposition-hint">Clasifica el motivo del contacto y añade el contexto de esta conversación.</p><label className="field-label" htmlFor={`category-${c.id}`}>Categoría</label><div className="select-wrap"><select id={`category-${c.id}`} data-testid={`select-category-${c.id}`} disabled={!editable||pending} value={draft.category} onChange={e=>{setDraft({...draft,category:e.target.value,subcategory:""});setDirty(true);setSaved(false);}}><option value="">Selecciona una categoría</option>{Object.keys(categories).map(x=><option key={x}>{x}</option>)}</select></div><label className="field-label" htmlFor={`subcategory-${c.id}`}>Subcategoría</label><div className="select-wrap"><select id={`subcategory-${c.id}`} data-testid={`select-subcategory-${c.id}`} disabled={!editable||pending||!draft.category} value={draft.subcategory} onChange={e=>{setDraft({...draft,subcategory:e.target.value});setDirty(true);setSaved(false);}}><option value="">Selecciona una subcategoría</option>{(categories[draft.category]||[]).map(x=><option key={x}>{x}</option>)}</select></div><label className="field-label" htmlFor={`notes-${c.id}`}>Notas internas</label><textarea id={`notes-${c.id}`} data-testid={`input-notes-${c.id}`} className="notes-area" disabled={!editable||pending} value={draft.notes} onChange={e=>{setDraft({...draft,notes:e.target.value});setDirty(true);setSaved(false);}} placeholder="Añade contexto para el siguiente agente…"/>{editable&&<button data-testid={`button-save-notes-${c.id}`} className="contact-action" disabled={pending||!dirty||!draft.category||!draft.subcategory} onClick={()=>void save()} style={{marginTop:12}}>Guardar disposición y notas</button>}{saved&&<p className="success-note" role="status">Disposición y notas guardadas.</p>}{dirty&&<p className="muted-copy">Cambios sin guardar. El borrador no se reemplaza con las actualizaciones.</p>}{error&&<p className="muted-copy" role="alert">{error}</p>}{conflict&&<div className="tracking-empty"><strong>Otra persona ha actualizado estas notas</strong><p>Tu borrador sigue intacto. Revisa la versión guardada antes de volver a intentarlo.</p><p style={{whiteSpace:"pre-wrap",marginTop:12}}>{c.category} · {c.subcategory}<br/>{c.notes}</p><button className="text-link" onClick={()=>{setDraft(d=>({...d,version:c.version}));setConflict(false);setError("");}}>Mantener mi borrador y usar la versión actual</button></div>}</>;
}
export function CustomerPanel({ conversation:c,state,act,pending }: {conversation:Conversation;state:OrbitState;act:OrbitAction;pending:boolean}) {
  const [tab,setTab]=useState("info");
  const [editing,setEditing]=useState(false);
  const [orderSearch,setOrderSearch]=useState("");
  const [orderId,setOrderId]=useState<string|null>(null);
  const editable=c.status==="active"&&c.assignedTo===state.me.id;
  const found=state.orders.filter(o=>o.number.toLowerCase().includes((orderSearch||c.customer.orderNumber).trim().toLowerCase()));
  return <aside className="side-panel"><div className="side-top"><span className="side-title">Espacio del cliente</span><span className="order-chip">{c.customer.orderNumber||"Sin pedido"}</span></div><div className="side-tabs" role="tablist">{[{id:"info",label:"Info",icon:CircleHelp},{id:"notes",label:"Disposición y notas",icon:FileText},{id:"order",label:"Seguimiento",icon:Box}].map(t=><button data-testid={`tab-${t.id}`} key={t.id} role="tab" aria-selected={tab===t.id} className={`side-tab ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}><t.icon size={13}/>{t.label}</button>)}</div><div className="side-content">
    {tab==="info"&&<><div className="section-kicker">Perfil del cliente</div><div className="profile-card"><div className="profile-card-head"><div className="large-avatar">{initials(c.customer.name)}</div><div><div className="customer-name">{c.customer.name}</div><div className="customer-tier">Cliente Orbit Home</div></div></div><div className="info-grid">{(["model","orderNumber","phone","email"] as const).map(key=><div key={key} className={`info-item ${key==="phone"||key==="email"?"wide":""}`}><label>{customerLabels[key]}</label><span data-testid={`text-customer-${key}`}>{c.customer[key]||"Sin registrar"}</span></div>)}</div>{editable&&<button className="text-link" data-testid="button-edit-customer" onClick={()=>setEditing(true)} style={{marginTop:14}}>Editar datos del cliente</button>}</div><div className="reason-card"><span className="reason-label">Motivo de consulta</span><div className="reason-copy">{c.messages.find(m=>m.from==="customer")?.text||"Sin mensaje inicial"}</div></div><div className="section-kicker">Relación con Orbit</div><div className="summary-status">{c.customer.since||"Sin antigüedad registrada"}</div><div className="order-summary"><div className="summary-row"><span>Producto</span><strong>{c.customer.model||"Sin registrar"}</strong></div><div className="summary-row"><span>Canal de contacto</span><strong>Chat web</strong></div></div></>}
    <div hidden={tab!=="notes"}><Notes conversation={c} act={act} pending={pending} editable={editable}/></div>
    {tab==="order"&&<><div className="section-kicker">Estado del pedido</div><p className="tracking-intro">Registros manuales del equipo. No conectado a un transportista.</p><div className="search-wrap"><Search size={14}/><input className="tracking-search" data-testid={`input-order-search-${c.id}`} style={{paddingLeft:32}} aria-label="Buscar número de pedido" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Número de pedido"/></div>{found.length?found.map(o=><div className="tracking-empty" key={o.id}><strong>{o.number} · {orderStatusLabel[o.status]||"Sin estado"}</strong><p>{o.model} · {o.tracking||"Sin seguimiento"}</p>{o.purchasedAt&&<p>Compra: {new Date(o.purchasedAt).toLocaleDateString("es")}</p>}{o.events.map((ev,i)=><div className="order-event" key={i}>{ev.date}<br/>{ev.label}</div>)}{state.owner&&<button className="text-link" onClick={()=>setOrderId(o.id)}>Editar registro</button>}</div>):<div className="tracking-empty"><strong>No hay pedidos registrados</strong><p>No hay información verificada para esta búsqueda.</p></div>}{state.owner&&<button className="contact-action" style={{marginTop:18}} data-testid={`button-create-order-${c.id}`} onClick={()=>setOrderId("")}>Crear registro de pedido</button>}</>}
  </div>{editing&&<Modal title="Editar cliente" close={()=>setEditing(false)}><CustomerForm customer={c.customer} pending={pending} save={async customer=>{await act({action:"saveCustomer",id:c.id,customer});setEditing(false);}}/></Modal>}{orderId!==null&&<Modal title={orderId?"Editar pedido":"Registrar pedido"} close={()=>setOrderId(null)}><OrderEditor order={state.orders.find(o=>o.id===orderId)} act={act} pending={pending} done={()=>setOrderId(null)}/></Modal>}</aside>;
}
