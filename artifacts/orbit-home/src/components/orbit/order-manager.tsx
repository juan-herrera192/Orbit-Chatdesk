import { useState } from "react";
import type { OrbitState, Order } from "@workspace/api-client-react";
import type { OrbitAction } from "@/hooks/use-orbit";
import { Empty, Modal } from "./shared";
import { OrderEditor, orderStatusLabel } from "./resources";

export function OrderManager({state,act,pending}:{state:OrbitState;act:OrbitAction;pending:boolean}) {
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Order|null|undefined>(undefined);
  const [search,setSearch]=useState("");
  const found=state.orders.filter(o=>`${o.number} ${o.email} ${o.model}`.toLowerCase().includes(search.toLowerCase()));
  if(!state.owner)return null;
  return <section className="order-summary">
    <h3 style={{fontSize:14}}>Registros de pedidos</h3>
    <p className="muted-copy">Gestiona los pedidos del espacio, también antes de recibir una consulta. Solo el propietario puede modificarlos.</p>
    <button className="contact-action" data-testid="button-manage-orders" onClick={()=>{setEditing(undefined);setOpen(true);}}>Gestionar pedidos</button>
    {open&&<Modal title={editing===undefined?"Registros de pedidos":editing?"Editar pedido":"Crear pedido"} close={()=>setOpen(false)}>
      {editing===undefined?<><p className="route-intro">Información introducida por el equipo. Sin conexión a transportistas.</p><div className="button-row"><button className="contact-action" data-testid="button-owner-create-order" onClick={()=>setEditing(null)}>Crear registro de pedido</button></div><input className="modal-search" style={{marginTop:18}} data-testid="input-admin-order-search" aria-label="Buscar pedidos" placeholder="Buscar número, correo o modelo…" value={search} onChange={e=>setSearch(e.target.value)}/>{found.map(o=><button className="kb-article" data-testid={`button-edit-order-${o.id}`} key={o.id} onClick={()=>setEditing({...o})}><small>{orderStatusLabel[o.status]}</small>{o.number} · {o.model||"Sin modelo"}</button>)}{!found.length&&<Empty title="Sin registros de pedidos"><p>{search?"Prueba con otra búsqueda.":"Añade un pedido con información confirmada para que tu equipo pueda consultarlo."}</p></Empty>}</>:<><button className="text-link" style={{marginBottom:18}} onClick={()=>setEditing(undefined)}>Volver a los registros</button><OrderEditor key={editing?.id||"new"} order={editing||undefined} act={act} pending={pending} done={()=>setEditing(undefined)}/></>}
    </Modal>}
  </section>;
}
