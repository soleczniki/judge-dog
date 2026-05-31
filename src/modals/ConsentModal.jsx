import { useState } from "react";
import { T } from "../theme.js";
import { completeRegistration } from "../firebase.js";
import { Modal } from "../components/Modal.jsx";
import { Btn } from "../components/atoms.jsx";

const ROLES = [
  {
    value: "exhibitor",
    label: "Owner / Handler",
    desc: "I enter dogs in shows and competitions. I research judges and write reviews.",
  },
  {
    value: "organizer_unverified",
    label: "Event Organiser",
    desc: "I organise shows, trials or other events and need to find and book judges. Identity verification required.",
  },
];

export function ConsentModal({user, onClose, onComplete}) {
  const [role, setRole]     = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  async function submit() {
    if (!role)   { setErr("Please select how you are joining."); return; }
    if (!agreed) { setErr("You must agree to the terms to continue."); return; }
    setSaving(true); setErr("");
    try {
      const full = await completeRegistration(user.uid, { name: user.name, email: user.email, photo: user.photo, role });
      onComplete(full);
    } catch(e) {
      console.error(e);
      setErr("Something went wrong — please try again.");
    }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title="One more step" subtitle="Tell us how you're joining judge.dog">

      {/* Role selector */}
      <p style={{margin:"0 0 10px",fontSize:13,fontWeight:500,color:T.textSub}}>I am joining as…</p>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {ROLES.map(r => {
          const active = role === r.value;
          return (
            <button key={r.value} onClick={()=>setRole(r.value)}
              style={{
                flex:1, padding:"14px 12px", borderRadius:T.r, cursor:"pointer", fontFamily:"inherit",
                textAlign:"left", transition:"all .15s",
                border: `2px solid ${active ? T.accent : T.border}`,
                background: active ? T.accentLight : T.bg,
              }}>
              <div style={{fontSize:14,fontWeight:600,color:active?T.accent:T.text,marginBottom:5}}>
                {r.label}
              </div>
              <div style={{fontSize:12,color:T.textSub,lineHeight:1.5}}>{r.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Terms checkbox */}
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

      <Btn fullWidth onClick={submit} disabled={saving||!agreed||!role}>
        {saving ? "Creating account…" : "Create my account"}
      </Btn>

      <p style={{margin:"14px 0 0",fontSize:12,color:T.textHint,textAlign:"center",lineHeight:1.6}}>
        By continuing you also consent to receiving transactional emails from judge.dog.
        {role==="organizer_unverified" && " You'll be prompted to verify your identity before sending booking inquiries."}
      </p>
    </Modal>
  );
}
