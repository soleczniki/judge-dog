import { T } from "../theme.js";

export function Modal({onClose,children,title,subtitle,wide,confirmClose}) {
  const handleBackdrop = e => {
    if (e.target !== e.currentTarget) return;
    if (confirmClose && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    onClose();
  };
  return (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.38)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(1px)"}}
    onClick={handleBackdrop}>
    <div style={{background:T.bg,borderRadius:T.rlg,width:"100%",maxWidth:wide?640:440,maxHeight:"92vh",overflowY:"auto",boxShadow:T.shadowLg,position:"relative"}}>
      <div style={{padding:"24px 24px 0",display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          {title&&<h2 style={{margin:"0 0 2px",fontSize:20,fontWeight:400,color:T.text,letterSpacing:-0.3}}>{title}</h2>}
          {subtitle&&<p style={{margin:0,fontSize:13,color:T.textSub}}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{background:T.surface,border:"none",cursor:"pointer",color:T.textSub,fontSize:16,width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12}}>✕</button>
      </div>
      <div style={{padding:"0 24px 24px"}}>{children}</div>
    </div>
  </div>
  );
}
