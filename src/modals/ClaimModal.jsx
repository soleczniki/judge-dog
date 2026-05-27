import { useState } from "react";
import { T } from "../theme.js";
import { Modal } from "../components/Modal.jsx";
import { Btn } from "../components/atoms.jsx";

export function ClaimModal({judge,user,onClose}) {
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);
  const [err,setErr]=useState("");

  async function submit() {
    setSending(true); setErr("");
    try {
      const {db}=await import("../firebase.js");
      const {doc,setDoc}=await import("firebase/firestore");
      // Deterministic ID: one claim per user per judge, setDoc overwrites if re-submitted
      await setDoc(doc(db,"claims",`${judge.id}__${user.uid}`),{
        judgeId:judge.id, judgeName:judge.name, judgeSlug:judge.slug||judge.id,
        userId:user.uid, userName:user.name, userEmail:user.email,
        status:"pending", submittedAt:new Date().toISOString(),
      });
      setDone(true);
    } catch(e){console.error(e);setErr("Failed to submit — please try again.");}
    setSending(false);
  }

  if(done) return (
    <Modal onClose={onClose} title="Claim submitted">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>✓</div>
        <p style={{fontSize:15,fontWeight:500,color:T.text,margin:"0 0 8px"}}>Request received</p>
        <p style={{fontSize:13,color:T.textSub,margin:"0 0 24px",lineHeight:1.6}}>We'll review your claim and approve it shortly. Once approved you'll have full access to your profile.</p>
        <Btn onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} title="Claim this profile" subtitle={`Are you ${judge.name}?`}>
      <p style={{fontSize:13,color:T.textSub,lineHeight:1.7,margin:"0 0 20px"}}>Once approved you'll be able to manage your profile, reply to reviews, and receive messages directly from exhibitors and show organisers.</p>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit} disabled={sending}>{sending?"Submitting…":"Submit claim request"}</Btn>
    </Modal>
  );
}
