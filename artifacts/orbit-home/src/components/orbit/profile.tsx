import { useState } from "react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import type { OrbitState } from "@workspace/api-client-react";
import { errorText, type OrbitAction } from "@/hooks/use-orbit";
import { roles } from "./resources";
import { OrderManager } from "./order-manager";

export function Profile({state,act,pending}:{state:OrbitState;act:OrbitAction;pending:boolean}) {
  const [name,setName]=useState(state.me.name);
  const [role,setRole]=useState(state.me.role);
  const [invite,setInvite]=useState("");
  const [copied,setCopied]=useState("");
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);
  const [joining,setJoining]=useState(false);
  const [rotating,setRotating]=useState(false);
  const [signingOut,setSigningOut]=useState(false);
  const {signOut}=useClerk();
  const client=useQueryClient();
  const link=`${window.location.origin}/chat/${state.publicKey}`;
  async function copy(text:string,key:string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); }
    catch { setError("No se pudo copiar. Selecciona y copia el texto del campo."); }
  }
  return <div className="form-stack">
    <form className="form-stack" onSubmit={async e=>{
      e.preventDefault(); setError("");
      try { await act({action:"profile",name:name.trim(),role}); setSaved(true); }
      catch(e) { setError(errorText(e)); }
    }}>
      <label>Nombre visible<input data-testid="input-profile-name" value={name} disabled={pending} onChange={e=>{setName(e.target.value);setSaved(false);}} required maxLength={100}/></label>
      <label>Rol<select data-testid="select-profile-role" value={role} disabled={pending} onChange={e=>{setRole(e.target.value);setSaved(false);}}>{roles.map(r=><option key={r}>{r}</option>)}</select></label>
      <button className="contact-action" data-testid="button-save-profile" disabled={pending||!name.trim()}>Guardar perfil</button>
      {saved&&<p className="success-note" role="status">Perfil actualizado.</p>}
    </form>
    <div className="order-summary">
      <h3 style={{fontSize:14}}>Enlace público de atención</h3>
      <p className="muted-copy">Compártelo con tus clientes. Las nuevas consultas aparecerán en la cola de este espacio.</p>
      <label>Enlace del cliente<input data-testid="text-public-link" readOnly value={link} onFocus={e=>e.target.select()}/></label>
      <div className="button-row">
        <button className="contact-action" data-testid="button-copy-public-link" onClick={()=>void copy(link,"link")}>{copied==="link"?"Enlace copiado":"Copiar enlace"}</button>
        <a data-testid="link-public-portal" className="text-link" href={link} target="_blank" rel="noreferrer">Abrir portal del cliente</a>
      </div>
    </div>
    {state.owner&&<div className="order-summary">
      <h3 style={{fontSize:14}}>Invitar a un agente</h3>
      <p className="muted-copy">Comparte este código solo con personal de confianza. Debe crear una cuenta y usar «Unirme a un equipo».</p>
      <input aria-label="Código de invitación" data-testid="text-invite-code" readOnly value={state.inviteCode} onFocus={e=>e.target.select()}/>
      <div className="button-row">
        <button className="contact-action" data-testid="button-copy-invite" onClick={()=>void copy(state.inviteCode,"invite")}>{copied==="invite"?"Código copiado":"Copiar código"}</button>
        <button className="text-link" data-testid="button-rotate-invite" disabled={pending} onClick={()=>setRotating(true)}>Renovar código</button>
      </div>
      {rotating&&<>
        <p className="muted-copy">El código anterior dejará de funcionar. Los integrantes actuales conservarán el acceso.</p>
        <div className="button-row">
          <button className="contact-action" disabled={pending} onClick={async()=>{try{await act({action:"rotateInvite"});setRotating(false);setCopied("");}catch(e){setError(errorText(e));}}}>Confirmar renovación</button>
          <button className="text-link" disabled={pending} onClick={()=>setRotating(false)}>Cancelar</button>
        </div>
      </>}
    </div>}
    {state.owner&&<OrderManager state={state} act={act} pending={pending}/>}
    <form className="form-stack order-summary" onSubmit={e=>{e.preventDefault();setJoining(true);}}>
      <h3 style={{fontSize:14}}>Unirme a un equipo</h3>
      <p className="muted-copy">Dejarás de ver este espacio y trabajarás en el espacio del código de invitación.</p>
      <label>Código de invitación<input data-testid="input-join-code" required disabled={pending} value={invite} onChange={e=>setInvite(e.target.value.trim())}/></label>
      {joining?<>
        <p className="muted-copy">¿Confirmas que quieres cambiar de espacio de trabajo?</p>
        <div className="button-row">
          <button type="button" className="contact-action" disabled={pending||!invite} onClick={async()=>{try{await act({action:"join",inviteCode:invite});setJoining(false);setInvite("");}catch(e){setError(errorText(e));}}}>Confirmar y unirme</button>
          <button type="button" className="text-link" disabled={pending} onClick={()=>setJoining(false)}>Cancelar</button>
        </div>
      </>:<button className="contact-action" data-testid="button-join" disabled={pending||!invite}>Unirme al equipo</button>}
    </form>
    {error&&<p role="alert" className="muted-copy">{error}</p>}
    <button className="resolve-button" style={{margin:0,justifyContent:"center"}} data-testid="button-sign-out" disabled={signingOut||pending} onClick={async()=>{
      setSigningOut(true); setError("");
      try { await client.cancelQueries(); client.clear(); await signOut({redirectUrl:"/"}); }
      catch(e) { setError(errorText(e)); setSigningOut(false); }
    }}>{signingOut?"Cerrando sesión…":"Cerrar sesión"}</button>
  </div>;
}
