import { useState } from "react";
import { T } from "../theme.js";
import { completeRegistration } from "../firebase.js";
import { Modal } from "../components/Modal.jsx";
import { Btn } from "../components/atoms.jsx";

const ROLES = [
  {
    key: "owner",
    label: "Owner / Handler",
    desc: "I enter dogs in shows and competitions. I research judges and write reviews.",
  },
  {
    key: "organiser",
    label: "Event Organiser",
    desc: "I organise shows, trials or events and need to find and book judges.",
  },
];

export function ConsentModal({user, onClose, onComplete}) {
  const [selected, setSelected] = useState({ owner: false, organiser: false });
  const [agreed,   setAgreed]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  const toggle = key => setSelected(s => ({ ...s, [key]: !s[key] }));
  const anySelected = selected.owner || selected.organiser;

  async function submit() {
    if (!anySelected) { setErr("Please select at least one option."); return; }
    if (!agreed)      { setErr("You must agree to the terms to continue."); return; }
    setSaving(true); setErr("");
    try {
      const isOwnerHandler  = selected.owner;
      const organizerStatus = selected.organiser ? "unverified" : null;
      const full = await completeRegistration(user.uid, {
        name: user.name, email: user.email, photo: user.photo,
        role: "exhibitor",
        isOwnerHandler,
        organizerStatus,
      });
      onComplete(full);
    } catch(e) {
      console.error(e);
      setErr("Something went wrong — please try again.");
    }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title="One more step" subtitle="Tell us how you're joining judge.dog">

      {/* Role checkboxes */}
      <p style={{margin:"0 0 6px",fontSize:13,fontWeight:500,color:T.textSub}}>
        I am joining as… <span style={{fontWeight:400,color:T.textHint}}>(select all that apply)</span>
      </p>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {ROLES.map(r => {
          const active = selected[r.key];
          return (
            <button key={r.key} onClick={()=>toggle(r.key)}
              style={{
                flex:1, padding:"14px 12px", borderRadius:T.r, cursor:"pointer",
                fontFamily:"inherit", textAlign:"left", transition:"all .15s",
                border:`2px solid ${active ? T.accent : T.border}`,
                background: active ? T.accentLight : T.bg,
              }}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <div style={{
                  width:16,height:16,borderRadius:3,flexShrink:0,
                  border:`2px solid ${active?T.accent:T.border}`,
                  background:active?T.accent:"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  {active&&<span style={{color:"#fff",fontSize:11,lineHeight:1,fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:14,fontWeight:600,color:active?T.accent:T.text}}>{r.label}</span>
              </div>
              <div style={{fontSize:12,color:T.textSub,lineHeight:1.5,paddingLeft:24}}>{r.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Terms */}
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

      <Btn fullWidth onClick={submit} disabled={saving||!agreed||!anySelected}>
        {saving ? "Creating account…" : "Create my account"}
      </Btn>

      <p style={{margin:"14px 0 0",fontSize:12,color:T.textHint,textAlign:"center",lineHeight:1.6}}>
        By continuing you also consent to receiving transactional emails from judge.dog.
      </p>
    </Modal>
  );
}
