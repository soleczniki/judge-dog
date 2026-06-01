import { useState } from "react";
import { T } from "../theme.js";
import { uid } from "../utils.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field } from "../components/atoms.jsx";

export function BookingModal({judge,user,onClose,onSubmit}) {
  const [f,setF]=useState({showName:"",date:"",location:"",country:"",breeds:"",entries:"",feeDiscussion:"",message:""});
  const [done,setDone]=useState(false);
  const [err,setErr]=useState("");
  const [touched,setTouched]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  async function submit() {
    setTouched(true);
    if (!f.showName.trim()||!f.date||!f.location.trim()||!f.breeds.trim()) {
      setErr("Please fill in all required fields.");
      return;
    }
    setErr("");
    await onSubmit({id:uid(),judgeId:judge.id,organizerId:user.id,organizerName:user.name,status:"pending",submittedAt:new Date().toISOString(),...f});
    setDone(true);
  }

  if (done) return (
    <Modal onClose={onClose} title="Request sent">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>✓</div>
        <p style={{color:T.textSub,fontSize:14,lineHeight:1.7,margin:"0 0 20px"}}>Your booking request has been sent to <strong>{judge.name}</strong>.</p>
        <Btn onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} title="Request booking" subtitle={`Send a booking inquiry to ${judge.name}`} wide>
      <div className="form-row" style={{marginBottom:12}}>
        <Field label="Show name *"         value={f.showName}  onChange={e=>set("showName",e.target.value)}  error={touched&&!f.showName.trim()}/>
        <Field label="Date *"              type="date" value={f.date} onChange={e=>set("date",e.target.value)} error={touched&&!f.date}/>
        <Field label="City / Venue *"      value={f.location}  onChange={e=>set("location",e.target.value)}  error={touched&&!f.location.trim()}/>
        <Field label="Country *"           value={f.country}   onChange={e=>set("country",e.target.value)}   error={touched&&!f.country.trim()}/>
        <Field label="Breeds to be judged *" value={f.breeds}  onChange={e=>set("breeds",e.target.value)}   error={touched&&!f.breeds.trim()}/>
        <Field label="Expected entries"    value={f.entries}   onChange={e=>set("entries",e.target.value)}   placeholder="Approx. number"/>
      </div>
      <Field label="Fee & travel" value={f.feeDiscussion} onChange={e=>set("feeDiscussion",e.target.value)} placeholder="Budget, travel covered, accommodation…" style={{marginBottom:12}}/>
      <Field label="Additional message" multiline rows={3} value={f.message} onChange={e=>set("message",e.target.value)} style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit}>Send request</Btn>
    </Modal>
  );
}
