import { useState } from "react";
import { T } from "../theme.js";
import { completeRegistration } from "../firebase.js";
import { Modal } from "../components/Modal.jsx";
import { Btn } from "../components/atoms.jsx";

export function ConsentModal({user, onClose, onComplete}) {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!agreed) { setErr("You must agree to continue."); return; }
    setSaving(true); setErr("");
    try {
      const full = await completeRegistration(user.uid, { name:user.name, email:user.email, photo:user.photo });
      onComplete(full);
    } catch(e) {
      console.error(e);
      setErr("Something went wrong — please try again.");
    }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title="One more step" subtitle="Please review and accept our terms before creating your account">
      <div style={{padding:"14px 16px",background:T.surface,borderRadius:T.rsm,border:`1px solid ${T.border}`,marginBottom:20}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:500,color:T.text}}>Welcome to judge.dog</p>
        <p style={{margin:0,fontSize:13,color:T.textSub,lineHeight:1.6}}>
          You're signing in as <strong>{user.email}</strong>. Your account will be created
          with the Exhibitor role. You can submit reviews, message judges, and request bookings.
        </p>
      </div>
      <label style={{display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer",marginBottom:20,userSelect:"none"}}>
        <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
          style={{marginTop:2,width:16,height:16,accentColor:T.accent,flexShrink:0,cursor:"pointer"}}/>
        <span style={{fontSize:14,color:T.text,lineHeight:1.65}}>
          I have read and agree to the{" "}
          <a href="/terms" target="_blank" rel="noreferrer" style={{color:T.accent,fontWeight:500}}>Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" style={{color:T.accent,fontWeight:500}}>Privacy Policy</a>.
          I understand that my name, email address, and profile photo will be stored to operate my account.
        </span>
      </label>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit} disabled={saving||!agreed}>{saving?"Creating account…":"Create my account"}</Btn>
      <p style={{margin:"14px 0 0",fontSize:12,color:T.textHint,textAlign:"center",lineHeight:1.6}}>
        By continuing you also consent to receiving transactional emails (e.g. claim status updates) from judge.dog.
      </p>
    </Modal>
  );
}
