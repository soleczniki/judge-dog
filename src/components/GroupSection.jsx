import { useState } from "react";
import { T } from "../theme.js";
import { FCI_GROUP_BREEDS } from "../../fci-groups.js";
import { Chip } from "./atoms.jsx";

export function GroupSection({groupNum, groupName}) {
  const [open,setOpen]=useState(false);
  const breeds = FCI_GROUP_BREEDS[groupNum] || [];
  return (
    <div style={{border:`1px solid ${T.border}`,borderRadius:T.rsm,marginBottom:6,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)}
        style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:open?T.accentLight:T.bg,border:"none",cursor:"pointer",fontFamily:"inherit",transition:"background .15s"}}>
        <span style={{fontSize:14,fontWeight:500,color:T.text}}>Group {groupNum} — {groupName}</span>
        <span style={{fontSize:12,color:T.textHint,display:"flex",alignItems:"center",gap:6}}>
          {breeds.length} breeds
          <span style={{fontSize:10,color:T.accent}}>{open?"▲":"▼"}</span>
        </span>
      </button>
      {open&&(
        <div style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,display:"flex",flexWrap:"wrap",gap:4,background:T.surface}}>
          {breeds.map(b=><Chip key={b} small>{b}</Chip>)}
        </div>
      )}
    </div>
  );
}
