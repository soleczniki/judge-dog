import { useState } from "react";
import { T } from "../theme.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field } from "../components/atoms.jsx";

export function StartConvModal({judge, user, onClose, onCreated}) {
  const [text,setText]=useState("");
  const [sending,setSending]=useState(false);
  const [err,setErr]=useState("");

  const send=async()=>{
    if(!text.trim()){setErr("Please write a message.");return;}
    setSending(true); setErr("");
    try {
      const {db}=await import("../firebase.js");
      const {doc,setDoc,collection,addDoc}=await import("firebase/firestore");
      const cid=`${judge.id}__${user.uid}`;
      const now=new Date().toISOString();
      await setDoc(doc(db,"conversations",cid),{
        judgeId:judge.id, judgeName:judge.name, judgeSlug:judge.slug||judge.id,
        senderUid:user.uid, senderName:user.name, senderPhoto:user.photo||null,
        lastMessage:text.trim(), lastMessageAt:now, lastMessageBy:"sender",
        unreadForJudge:1, unreadForSender:0, createdAt:now,
      },{merge:true});
      await addDoc(collection(db,"conversations",cid,"messages"),{
        from:"sender", fromName:user.name, fromUid:user.uid,
        text:text.trim(), sentAt:now,
      });
      onCreated(cid);
      onClose();
    } catch(e){console.error(e);setErr("Failed to send — please try again.");}
    setSending(false);
  };

  return (
    <Modal onClose={onClose} title={`Message ${judge.name}`} subtitle="They'll be notified and can reply from their inbox">
      <Field label="Your message" multiline rows={5} value={text}
        onChange={e=>setText(e.target.value)}
        placeholder={`Write your message to ${judge.name}…`}
        style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={send} disabled={sending}>{sending?"Sending…":"Send message"}</Btn>
    </Modal>
  );
}
