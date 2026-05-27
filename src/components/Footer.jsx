import { T } from "../theme.js";

export function Footer({onManageCookies}) {
  return (
    <div style={{borderTop:`1px solid ${T.border}`,padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,background:T.surface}}>
      <span style={{fontSize:12,color:T.textHint}}>© {new Date().getFullYear()} Lenis res, MB · judge.dog</span>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        {[["Privacy Policy","/privacy"],["Terms of Service","/terms"],["Cookie Policy","/cookies"],["Review Guidelines","/review-guidelines"]].map(([label,href])=>(
          <a key={href} href={href} style={{fontSize:12,color:T.textHint,textDecoration:"none",transition:"color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.color=T.accent}
            onMouseLeave={e=>e.currentTarget.style.color=T.textHint}>
            {label}
          </a>
        ))}
        <button onClick={onManageCookies}
          style={{fontSize:12,color:T.textHint,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",transition:"color .15s"}}
          onMouseEnter={e=>e.currentTarget.style.color=T.accent}
          onMouseLeave={e=>e.currentTarget.style.color=T.textHint}>
          Manage cookies
        </button>
      </div>
    </div>
  );
}
