import { useState } from "react";
import { T } from "../theme.js";
import { avg } from "../utils.js";
import { Avatar, FlagImg, OrgPill, Chip, Stars } from "./atoms.jsx";

export function JudgeCard({judge,reviews,onClick}) {
  const [hov,setHov]=useState(false);
  const rv=reviews.filter(r=>r.judgeId===judge.id);
  const oa=avg(rv.map(r=>r.overall));
  const wr=rv.filter(r=>r.wouldReturn).length;

  // Breed/group summary for card
  const breedSummary = () => {
    if (judge.allBreedJudge) return <Chip small bg={T.greenLight} color={T.green}>All breeds</Chip>;
    if (judge.groupNames?.length) return (
      <>
        {judge.groupNames.slice(0,4).map(g=><Chip key={g.group} small>Group {g.group}</Chip>)}
        {judge.groupNames.length>4&&<Chip small>+{judge.groupNames.length-4} groups</Chip>}
        {judge.authorizedBreeds?.length>0&&<Chip small>+{judge.authorizedBreeds.length} breeds</Chip>}
      </>
    );
    if (judge.breeds?.length) return (
      <>
        {judge.breeds.slice(0,2).map(b=><Chip key={b} small>{b}</Chip>)}
        {judge.breeds.length>2&&<Chip small>+{judge.breeds.length-2}</Chip>}
      </>
    );
    return <Chip small color={T.textHint}>No breed data</Chip>;
  };

  const disciplineLabel = judge.disciplines?.length ? judge.disciplines[0] : (judge.group||"Shows");

  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:T.bg,borderRadius:T.r,padding:"18px",border:`1px solid ${hov?T.accent:T.border}`,cursor:"pointer",transition:"box-shadow .2s, border-color .2s",boxShadow:hov?T.shadowMd:T.shadow,overflow:"hidden"}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
        <div style={{position:"relative",flexShrink:0}}>
          <Avatar label={judge.photo} size={44}/>
          {judge.verified&&<div style={{position:"absolute",bottom:-2,right:-2,width:15,height:15,background:T.green,borderRadius:"50%",border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff"}}>✓</div>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h3 style={{margin:"0 0 2px",fontSize:15,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center"}}><FlagImg judge={judge}/>{judge.name}</h3>
          <p style={{margin:0,fontSize:12,color:T.textHint}}>
            {judge.country}
            {judge.birthYear&&<> · Born {judge.birthYear}</>}
            {judge.licensedYear&&<> · Lic. {judge.licensedYear}</>}
          </p>
        </div>
        {rv.length>0&&(
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:17,fontWeight:600,color:T.text,lineHeight:1.2}}>{oa.toFixed(1)}</div>
            <Stars val={oa} size={10}/>
          </div>
        )}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {judge.orgs.map(o=><OrgPill key={o.org} org={o.org}/>)}
        <Chip small>{disciplineLabel}</Chip>
        {judge.bisJudge&&<Chip bg="#fff8e1" color="#f57f17" small>★ BIS</Chip>}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
        {breedSummary()}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textHint,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
        {rv.length===0
          ? <span style={{fontStyle:"italic"}}>No reviews yet</span>
          : <>
              <span>{rv.length} review{rv.length!==1?"s":""}</span>
              <span style={{color:T.green,fontWeight:500}}>{Math.round(wr/rv.length*100)}% would return</span>
            </>
        }
      </div>
    </div>
  );
}
