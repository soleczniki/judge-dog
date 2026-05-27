import { useState } from "react";
import { T } from "../theme.js";
import { signInWithGoogle } from "../firebase.js";
import { Modal } from "../components/Modal.jsx";
import { ConsentModal } from "./ConsentModal.jsx";

export function AuthModal({onClose,onAuth}) {
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [pendingUser,setPendingUser]=useState(null);

  async function handleGoogle() {
    setLoading(true); setErr("");
    try {
      const user = await signInWithGoogle();
      if (user.needsConsent) { setPendingUser(user); }
      else { onAuth(user); onClose(); }
    } catch(e) {
      setErr("Sign-in failed. Please try again.");
    }
    setLoading(false);
  }

  if (pendingUser) return (
    <ConsentModal user={pendingUser} onClose={onClose} onComplete={u=>{onAuth(u);onClose();}}/>
  );

  return (
    <Modal onClose={onClose} title="Sign in to judge.dog" subtitle="Rate judges, write reviews, book talent">
      <button onClick={handleGoogle} disabled={loading}
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",padding:"12px 16px",border:`1.5px solid ${T.border}`,borderRadius:100,background:T.bg,fontSize:14,fontWeight:500,color:T.text,cursor:loading?"not-allowed":"pointer",marginBottom:10,fontFamily:"inherit",transition:"background .15s",opacity:loading?0.6:1}}
        onMouseEnter={e=>!loading&&(e.currentTarget.style.background=T.surface)}
        onMouseLeave={e=>(e.currentTarget.style.background=T.bg)}>
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.7 0-14.3 4.6-17.7 11.7z"/><path fill="#FBBC05" d="M24 45c5.5 0 10.5-1.9 14.4-5l-6.7-5.5C29.6 36 26.9 37 24 37c-6 0-10.6-3.1-11.8-7.4l-7 5.4C8 41.2 15.4 45 24 45z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.4-2.4 4.4-4.4 5.8l6.7 5.5C42.3 36.2 45 30.6 45 24c0-1.4-.1-2.7-.5-4z"/></svg>
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
      <div style={{display:"flex",alignItems:"center",gap:10,margin:"8px 0 14px"}}>
        <div style={{flex:1,height:1,background:T.border}}/><span style={{fontSize:12,color:T.textHint}}>Facebook coming soon</span><div style={{flex:1,height:1,background:T.border}}/>
      </div>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <p style={{margin:"16px 0 0",fontSize:12,color:T.textHint,textAlign:"center",lineHeight:1.6}}>
        By signing in you agree to our terms. Your role defaults to <strong>Exhibitor</strong>.
      </p>
    </Modal>
  );
}
