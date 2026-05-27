import { useState } from "react";
import { T } from "../theme.js";
import { UNIVERSAL_DIMS, GROUP_DIMS, GROUP_NAMES, ENTRY_LABELS, EMPTY_RATINGS } from "../theme.js";
import { judgeGroups, uid } from "../utils.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field, SectionLabel, Stars } from "../components/atoms.jsx";

export function ReviewModal({judge,user,onClose,onSubmit}) {
  const groups = judgeGroups(judge);
  const [selGroup,setSelGroup]=useState(groups[0]);
  const [f,setF]=useState({breed:"",show:"",wouldReturn:null,text:"",...EMPTY_RATINGS});
  const [err,setErr]=useState("");
  const [agreedToGuidelines,setAgreedToGuidelines]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const specificDims = GROUP_DIMS[selGroup]||GROUP_DIMS.A;
  const allDims = [...UNIVERSAL_DIMS, ...specificDims];
  const labels = ENTRY_LABELS[selGroup]||ENTRY_LABELS.A;

  async function submit() {
    setErr("");
    if (!f.breed.trim()||!f.show.trim()) { setErr(`Please fill in ${labels.entry.toLowerCase()} and ${labels.event.toLowerCase()}.`); return; }
    const missing = allDims.filter(d=>!f[d.key]);
    if (missing.length) { setErr(`Please rate: ${missing.map(d=>d.label).join(", ")}.`); return; }
    if (f.wouldReturn===null) { setErr("Please indicate if you'd compete/show under them again."); return; }
    if (!f.text.trim()) { setErr("Please write a review."); return; }
    if (!agreedToGuidelines) { setErr("Please confirm you agree to the Review Guidelines before submitting."); return; }
    await onSubmit({id:uid(),judgeId:judge.id,userId:user.id,userName:user.name,
      date:new Date().toISOString().slice(0,10),reply:null,disciplineGroup:selGroup,...f});
    onClose();
  }

  const RatingGroup = ({dims}) => (
    <div style={{background:T.surface,borderRadius:T.rsm,overflow:"hidden",border:`1px solid ${T.border}`}}>
      {dims.map((d,i)=>(
        <div key={d.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:i<dims.length-1?`1px solid ${T.border}`:"none"}}>
          <span style={{fontSize:14,color:T.text}}>{d.label}</span>
          <Stars val={f[d.key]} onChange={v=>set(d.key,v)} size={22}/>
        </div>
      ))}
    </div>
  );

  return (
    <Modal onClose={onClose} title={`Review ${judge.name}`} subtitle="Your experience helps fellow exhibitors" wide>
      {/* Discipline group selector — only shown when judge has multiple groups */}
      {groups.length>1&&(
        <div style={{marginBottom:16}}>
          <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"0 0 8px"}}>Which discipline are you reviewing?</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {groups.map(g=>(
              <button key={g} onClick={()=>setSelGroup(g)}
                style={{padding:"6px 14px",borderRadius:100,border:`1.5px solid ${selGroup===g?T.accent:T.border}`,background:selGroup===g?T.accentLight:T.bg,color:selGroup===g?T.accent:T.textSub,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                {GROUP_NAMES[g]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-row" style={{marginBottom:16}}>
        <Field label={labels.entry} value={f.breed} onChange={e=>set("breed",e.target.value)} placeholder={selGroup==="A"?"e.g. Golden Retriever":"e.g. Max / Open class"}/>
        <Field label={labels.event} value={f.show} onChange={e=>set("show",e.target.value)} placeholder={selGroup==="A"?"e.g. Crufts 2024":"e.g. National Championship 2024"}/>
      </div>

      <SectionLabel>Universal criteria</SectionLabel>
      <div style={{marginBottom:14}}><RatingGroup dims={UNIVERSAL_DIMS}/></div>

      <SectionLabel>{GROUP_NAMES[selGroup]} criteria</SectionLabel>
      <div style={{marginBottom:16}}><RatingGroup dims={specificDims}/></div>

      <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"0 0 8px"}}>Would you compete / show under them again?</p>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[true,false].map(v=>(
          <button key={String(v)} onClick={()=>set("wouldReturn",v)}
            style={{flex:1,padding:"10px",borderRadius:100,border:`1.5px solid ${f.wouldReturn===v?(v?T.green:T.red):T.border}`,background:f.wouldReturn===v?(v?T.greenLight:T.redLight):T.bg,color:f.wouldReturn===v?(v?T.green:T.red):T.textSub,fontWeight:500,fontSize:14,cursor:"pointer",transition:"all .15s",fontFamily:"inherit"}}>
            {v?"✓  Yes":"✗  No"}
          </button>
        ))}
      </div>

      <Field label="Your review" multiline rows={5} value={f.text} onChange={e=>set("text",e.target.value)} placeholder="Describe the judging style, what they prioritised, how they ran the ring…" style={{marginBottom:16}}/>

      {/* Guidelines agreement */}
      <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",marginBottom:16,padding:"12px 14px",background:agreedToGuidelines?T.accentLight:T.surface,border:`1.5px solid ${agreedToGuidelines?T.accent:T.border}`,borderRadius:T.rsm,transition:"all .15s"}}>
        <input type="checkbox" checked={agreedToGuidelines} onChange={e=>setAgreedToGuidelines(e.target.checked)}
          style={{marginTop:2,width:15,height:15,accentColor:T.accent,flexShrink:0,cursor:"pointer"}}/>
        <span style={{fontSize:13,color:T.textSub,lineHeight:1.5}}>
          I confirm this is my honest first-hand experience and I agree to the{" "}
          <a href="/review-guidelines" target="_blank" rel="noreferrer"
            style={{color:T.accent,textDecoration:"none",fontWeight:500}}
            onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"}
            onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>
            Review Guidelines ↗
          </a>
        </span>
      </label>

      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit}>Submit review</Btn>
    </Modal>
  );
}
