import { useState } from "react";
import { T } from "../theme.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field } from "../components/atoms.jsx";

export function ContactModal({judge,user,onClose}) {
  const [name,setName]=useState(user?.name||"");
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState("");

  const send=async()=>{
    if(!name.trim()||!message.trim()){setErr("Please fill in all fields.");return;}
    setSending(true); setErr("");
    try {
      const {db}=await import("../firebase.js");
      const {collection,addDoc}=await import("firebase/firestore");
      await addDoc(collection(db,"messages"),{
        judgeId:judge.id, judgeName:judge.name, judgeSlug:judge.slug||judge.id,
        fromName:name.trim(),
        message:message.trim(), sentAt:new Date().toISOString(),
        read:false, claimed:!!judge.claimedBy,
      });
      setSent(true);
    } catch(e){console.error(e);setErr("Failed to send — please try again.");}
    setSending(false);
  };

  if(sent) return (
    <Modal onClose={onClose} title="Message sent">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{fontSize:40,marginBottom:14}}>✓</div>
        <p style={{fontSize:15,color:T.text,margin:"0 0 8px",fontWeight:500}}>Your message has been sent</p>
        <p style={{fontSize:13,color:T.textSub,margin:"0 0 24px",lineHeight:1.6}}>
          {judge.claimedBy
            ? `${judge.name} will receive your message on judge.dog.`
            : `We'll forward your message to ${judge.name}'s registered email. They may not have joined judge.dog yet.`}
        </p>
        <Btn onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} title={`Contact ${judge.name}`}
      subtitle={judge.claimedBy?"The judge will receive your message.":"This judge hasn't joined judge.dog yet — we'll forward your message to their registered email."}>
      <Field label="Your name" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:10}}/>
      <Field label="Message" multiline rows={5} value={message} onChange={e=>setMessage(e.target.value)}
        placeholder={`Write your message to ${judge.name}…`} style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={send} disabled={sending}>{sending?"Sending…":"Send message"}</Btn>
    </Modal>
  );
}
