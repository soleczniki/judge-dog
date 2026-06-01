import { useState, useEffect } from "react";
import { T } from "../theme.js";
import { Btn, Field } from "../components/atoms.jsx";

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export function useRecaptcha() {
  useEffect(()=>{
    if(!RECAPTCHA_SITE_KEY||document.getElementById("recaptcha-script")) return;
    const s=document.createElement("script");
    s.id="recaptcha-script";
    s.src=`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    document.head.appendChild(s);
  },[]);
  return async(action)=>{
    if(!RECAPTCHA_SITE_KEY) return null;
    await new Promise(r=>{ if(window.grecaptcha?.ready) window.grecaptcha.ready(r); else setTimeout(r,1500); });
    return window.grecaptcha.execute(RECAPTCHA_SITE_KEY,{action});
  };
}

export function ContactPage({user}) {
  const [f,setF]=useState({name:user?.name||"",email:user?.email||"",subject:"",message:""});
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);
  const [err,setErr]=useState("");
  const [touched,setTouched]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const getToken=useRecaptcha();

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if(!f.name.trim()||!f.email.trim()||!f.message.trim()){setErr("Please fill in all required fields.");return;}
    setSending(true);setErr("");
    try {
      const token=await getToken("contact");
      const {db}=await import("../firebase.js");
      const {collection,addDoc}=await import("firebase/firestore");
      await addDoc(collection(db,"contact"),{
        name:f.name.trim(),email:f.email.trim(),
        subject:f.subject.trim()||"(no subject)",
        message:f.message.trim(),
        sentAt:new Date().toISOString(),
        userId:user?.uid||null,
        recaptchaToken:token||null,
      });
      setDone(true);
    } catch(e){setErr("Failed to send — please try again.");}
    setSending(false);
  }

  return (
    <div style={{maxWidth:600,margin:"0 auto",padding:"52px 24px 80px"}}>
      <h1 style={{margin:"0 0 6px",fontSize:28,fontWeight:400,color:T.text,letterSpacing:-0.5}}>Contact us</h1>
      <p style={{margin:"0 0 36px",fontSize:14,color:T.textSub,lineHeight:1.6}}>
        Questions, feedback, or issues with a profile — we read every message.
      </p>

      {done?(
        <div style={{textAlign:"center",padding:"48px 0"}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 16px"}}>✓</div>
          <p style={{fontSize:16,fontWeight:500,color:T.text,margin:"0 0 8px"}}>Message sent</p>
          <p style={{fontSize:14,color:T.textSub,margin:0}}>We'll get back to you at {f.email}.</p>
        </div>
      ):(
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-row">
            <Field label="Name *"  value={f.name}  onChange={e=>set("name",e.target.value)}  placeholder="Your name"        error={touched&&!f.name.trim()}/>
            <Field label="Email *" type="email" value={f.email} onChange={e=>set("email",e.target.value)} placeholder="you@example.com" error={touched&&!f.email.trim()}/>
          </div>
          <Field label="Subject" value={f.subject} onChange={e=>set("subject",e.target.value)} placeholder="e.g. Question about a judge profile"/>
          <Field label="Message *" multiline rows={6} value={f.message} onChange={e=>set("message",e.target.value)} placeholder="What's on your mind?" error={touched&&!f.message.trim()}/>
          {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red}}>{err}</div>}
          <Btn fullWidth onClick={submit} disabled={sending}>{sending?"Sending…":"Send message"}</Btn>
          <p style={{margin:0,fontSize:11,color:T.textHint,textAlign:"center",lineHeight:1.6}}>
            Protected by reCAPTCHA ·{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{color:T.textHint}}>Privacy</a>
            {" · "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" style={{color:T.textHint}}>Terms</a>
          </p>
        </form>
      )}
    </div>
  );
}
