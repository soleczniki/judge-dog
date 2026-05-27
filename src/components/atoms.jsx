import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { T } from "../theme.js";
import { aColor, initials, countryISO } from "../utils.js";
import { trackPageView } from "../firebase.js";

export const Avatar = ({label, photoUrl, size=40}) => {
  if (photoUrl) return (
    <img src={photoUrl} alt={label||""}
      style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:`2px solid ${T.border}`}}/>
  );
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:aColor(label||"?"),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.36,fontWeight:600,flexShrink:0}}>
      {label||"?"}
    </div>
  );
};

export const FlagImg = ({judge, height=14}) => {
  const iso = countryISO(judge);
  if (!iso) return null;
  return <img src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
              style={{height,width:"auto",borderRadius:2,verticalAlign:"middle",marginRight:4,flexShrink:0}}
              alt={iso}/>;
};

export const OrgPill = ({org}) => {
  const ORGS_MAP = {
    FCI:  { short: "FCI",  color: "#1a73e8" },
    AKC:  { short: "AKC",  color: "#e53935" },
    KC:   { short: "KC",   color: "#1e8e3e" },
    CKC:  { short: "CKC",  color: "#f29900" },
    ANKC: { short: "ANKC", color: "#9334e6" },
    JKC:  { short: "JKC",  color: "#e52592" },
  };
  const o = ORGS_MAP[org]||{short:org,color:"#5f6368"};
  return <span style={{display:"inline-flex",padding:"2px 8px",borderRadius:100,background:o.color,color:"#fff",fontSize:11,fontWeight:600,letterSpacing:0.2}}>{o.short}</span>;
};

export const Chip = ({children,bg,color,small}) => (
  <span style={{display:"inline-flex",alignItems:"center",padding:small?"2px 8px":"4px 12px",borderRadius:100,background:bg||T.surface,color:color||T.textSub,fontSize:small?11:12,fontWeight:500,border:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
    {children}
  </span>
);

export const Stars = ({val,onChange,size=18}) => {
  const [hov,setHov]=useState(0);
  return (
    <span style={{display:"inline-flex",gap:1,cursor:onChange?"pointer":"default"}}>
      {[1,2,3,4,5].map(i=>(
        <span key={i} style={{fontSize:size,color:(hov||val)>=i?"#f29900":"#dadce0",lineHeight:1,transition:"color .1s"}}
          onMouseEnter={()=>onChange&&setHov(i)} onMouseLeave={()=>onChange&&setHov(0)}
          onClick={()=>onChange&&onChange(i)}>★</span>
      ))}
    </span>
  );
};

export const RatingBar = ({label,value,highlight}) => (
  <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:13,color:highlight?T.text:T.textSub,fontWeight:highlight?500:400}}>{label}</span>
      <span style={{fontSize:13,fontWeight:600,color:value?T.text:T.textHint}}>{value?value.toFixed(1):"—"}</span>
    </div>
    <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${(value/5)*100}%`,background:highlight?T.accent:"#80aaee",borderRadius:2,transition:"width .4s"}}/>
    </div>
  </div>
);

export const SectionLabel = ({children}) => (
  <p style={{margin:"0 0 10px",fontSize:11,fontWeight:600,color:T.textHint,textTransform:"uppercase",letterSpacing:1}}>{children}</p>
);

export const InfoRow = ({label,value}) => {
  if (!value) return null;
  return (
    <div style={{display:"flex",gap:12,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
      <span style={{minWidth:168,fontSize:13,color:T.textHint,flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,color:T.text}}>{value}</span>
    </div>
  );
};

export const Divider = ({my=16}) => <div style={{height:1,background:T.border,margin:`${my}px 0`}}/>;

export const Btn = ({children,onClick,variant="filled",color,small,fullWidth,icon,disabled}) => {
  const [hov,setHov]=useState(false);
  const styles = {
    filled:{bg:color||T.accent,text:"#fff",border:"none",hovBg:`${color||T.accent}dd`},
    tonal:{bg:T.accentLight,text:T.accent,border:"none",hovBg:"#d2e3fc"},
    outlined:{bg:"transparent",text:T.textSub,border:`1.5px solid ${T.border}`,hovBg:T.surface},
  };
  const s = styles[variant]||styles.filled;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:small?"6px 14px":"10px 22px",background:hov&&!disabled?s.hovBg:s.bg,color:disabled?"#9aa0a6":s.text,border:s.border||"none",borderRadius:100,fontSize:small?13:14,fontWeight:500,cursor:disabled?"not-allowed":"pointer",transition:"background .15s",width:fullWidth?"100%":"auto",letterSpacing:0.1,outline:"none",boxShadow:variant==="filled"&&!disabled?T.shadow:"none",fontFamily:"inherit"}}>
      {icon&&<span style={{fontSize:15,lineHeight:1}}>{icon}</span>}
      {children}
    </button>
  );
};

export const Field = ({label,value,onChange,type="text",multiline,rows=4,placeholder,style:s}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...s}}>
    {label&&<label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2}}>{label}</label>}
    {multiline
      ? <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder}
          style={{padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:T.bg,resize:"vertical",outline:"none",color:T.text,lineHeight:1.6}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
      : <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          style={{padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:T.bg,outline:"none",color:T.text}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
    }
  </div>
);

export function ScrollToTop() {
  const {pathname}=useLocation();
  useEffect(()=>{
    window.scrollTo(0,0);
    trackPageView(pathname);
  },[pathname]);
  return null;
}
