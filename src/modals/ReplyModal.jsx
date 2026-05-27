import { useState } from "react";
import { T } from "../theme.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field } from "../components/atoms.jsx";

export function ReplyModal({review,onClose,onReply}) {
  const [text,setText]=useState(review.reply||""); const [err,setErr]=useState("");
  async function submit() { if (!text.trim()) { setErr("Reply cannot be empty."); return; } await onReply(review.id,text.trim()); onClose(); }
  return (
    <Modal onClose={onClose} title="Reply to review" subtitle={`Replying to ${review.userName}`}>
      <div style={{padding:"11px 14px",background:T.surface,borderRadius:T.rsm,fontSize:13,color:T.textSub,marginBottom:16,lineHeight:1.65,borderLeft:`3px solid ${T.border}`}}>
        "{review.text.slice(0,180)}{review.text.length>180?"…":""}"
      </div>
      <Field multiline rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="Write a professional, constructive reply…" style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit}>Post reply</Btn>
    </Modal>
  );
}
