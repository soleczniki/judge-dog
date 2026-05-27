import { useState } from "react";
import { T } from "../theme.js";
import { GROUP_NAMES } from "../theme.js";
import { fmtDate, initials, reviewDims } from "../utils.js";
import { Avatar, Stars } from "./atoms.jsx";

export function ReviewCard({review,isJudge,onReply}) {
  const [exp,setExp]=useState(false);
  const [showAll,setShowAll]=useState(false);
  const long=review.text.length>240;
  const dims = reviewDims(review).filter(d=>d.key!=="overall"&&review[d.key]);
  const primary = dims.slice(0,3);
  const extra   = dims.slice(3);
  return (
    <div style={{padding:"20px 0",borderBottom:`1px solid ${T.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Avatar label={initials(review.userName)} size={36}/>
          <div>
            <p style={{margin:0,fontWeight:500,color:T.text,fontSize:14}}>{review.userName}</p>
            <p style={{margin:0,fontSize:12,color:T.textHint}}>
              {review.breed} · {review.show}
              {review.disciplineGroup&&<span style={{marginLeft:6,padding:"1px 6px",borderRadius:100,background:T.surface,border:`1px solid ${T.border}`,fontSize:11}}>{GROUP_NAMES[review.disciplineGroup]}</span>}
            </p>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <Stars val={review.overall} size={14}/>
          <p style={{margin:"3px 0 0",fontSize:11,color:T.textHint}}>{fmtDate(review.date)}</p>
        </div>
      </div>

      {/* Primary mini-ratings */}
      <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
        {primary.map(d=>(
          <span key={d.key} style={{fontSize:12,color:T.textSub}}>{d.label}: <span style={{color:T.amber,fontWeight:600}}>{"★".repeat(review[d.key])}{"☆".repeat(5-review[d.key])}</span></span>
        ))}
      </div>

      {/* Extra ratings — collapsible */}
      {extra.length>0&&(
        <div style={{marginBottom:10}}>
          {showAll&&(
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:6}}>
              {extra.map(d=>(
                <span key={d.key} style={{fontSize:12,color:T.textSub}}>{d.label}: <span style={{color:T.amber,fontWeight:600}}>{"★".repeat(review[d.key])}{"☆".repeat(5-review[d.key])}</span></span>
              ))}
            </div>
          )}
          <button onClick={()=>setShowAll(!showAll)} style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",fontWeight:500}}>
            {showAll?"Hide additional ratings ▲":`Show ${extra.length} more ratings ▼`}
          </button>
        </div>
      )}

      <p style={{margin:"0 0 10px",color:T.text,fontSize:14,lineHeight:1.7}}>
        {long&&!exp?review.text.slice(0,240)+"…":review.text}
        {long&&<span style={{color:T.accent,cursor:"pointer",marginLeft:6,fontSize:13,fontWeight:500}} onClick={()=>setExp(!exp)}>{exp?"Less":"More"}</span>}
      </p>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:500,color:review.wouldReturn?T.green:T.red}}>
          {review.wouldReturn?"✓ Would show under again":"✗ Would not show under again"}
        </span>
        {isJudge&&!review.reply&&(
          <button onClick={()=>onReply(review)} style={{fontSize:13,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0,fontFamily:"inherit"}}>Reply</button>
        )}
      </div>

      {review.reply&&(
        <div style={{marginTop:12,padding:"12px 14px",background:T.surface,borderRadius:T.rsm,borderLeft:`3px solid ${T.accent}`}}>
          <p style={{margin:"0 0 4px",fontSize:12,fontWeight:600,color:T.accent}}>Judge's reply</p>
          <p style={{margin:0,fontSize:13,color:T.text,lineHeight:1.65}}>{review.reply}</p>
        </div>
      )}
    </div>
  );
}
