import { T } from "../theme.js";

export function CookieBanner({onAccept, onDecline}) {
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:500,background:T.bg,borderTop:`1px solid ${T.border}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",boxShadow:"0 -2px 12px rgba(60,64,67,.10)"}}>
      <p style={{margin:0,fontSize:13,color:T.textSub,lineHeight:1.6,flex:1,minWidth:240}}>
        We use analytics cookies to understand how people use judge.dog. Essential cookies are always active.{" "}
        <a href="/cookies" style={{color:T.accent,textDecoration:"none",fontWeight:500}}>Cookie Policy</a>
      </p>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        <button onClick={onDecline}
          style={{padding:"8px 18px",borderRadius:100,border:`1.5px solid ${T.border}`,background:"none",color:T.textSub,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",transition:"background .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background="none"}>
          Decline
        </button>
        <button onClick={onAccept}
          style={{padding:"8px 18px",borderRadius:100,border:"none",background:T.accent,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",boxShadow:T.shadow}}>
          Accept cookies
        </button>
      </div>
    </div>
  );
}
