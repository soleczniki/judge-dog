import { useState } from "react";
import { T } from "../theme.js";
import { tc } from "../utils.js";
import { Chip } from "./atoms.jsx";

const BREEDS_PREVIEW = 10;

// provisionalSet: optional Set of breed names that are provisional/permit only
export function BreedList({breeds, label, provisionalSet}) {
  const [expanded, setExpanded] = useState(false);
  if (!breeds?.length) return null;
  const shown = expanded ? breeds : breeds.slice(0, BREEDS_PREVIEW);
  const extra = breeds.length - BREEDS_PREVIEW;
  return (
    <>
      {label && <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"14px 0 8px"}}>{label}</p>}
      <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
        {shown.map(b=>{
          const isProv = provisionalSet?.has(b);
          return (
            <span key={b} style={{display:"inline-flex",alignItems:"center",gap:2}}>
              <Chip small>{tc(b)}</Chip>
              {isProv&&<span title="Provisional approval" style={{fontSize:9,fontWeight:700,color:"#b45309",background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:4,padding:"0 3px",lineHeight:"14px",letterSpacing:.3}}>PROV</span>}
            </span>
          );
        })}
        {!expanded && extra>0 && (
          <button onClick={()=>setExpanded(true)}
            style={{fontSize:12,color:T.accent,background:"none",border:`1px solid ${T.border}`,borderRadius:100,padding:"2px 10px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            +{extra} more
          </button>
        )}
        {expanded && breeds.length>BREEDS_PREVIEW && (
          <button onClick={()=>setExpanded(false)}
            style={{fontSize:12,color:T.textHint,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:"2px 4px"}}>
            show less
          </button>
        )}
      </div>
    </>
  );
}
