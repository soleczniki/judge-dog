import { useState } from "react";
import { T } from "../theme.js";
import { COUNTRIES } from "../countries.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field } from "../components/atoms.jsx";

export function BookingModal({judge, user, onClose}) {
  const [f, setF] = useState({
    showName:"", date:"", location:"", country:"",
    breeds:"", entries:"", feeDiscussion:"", message:"",
  });
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  async function submit() {
    setTouched(true);
    if (!f.showName.trim()||!f.date||!f.location.trim()||!f.breeds.trim()) {
      setErr("Please fill in all required fields.");
      return;
    }
    setSending(true); setErr("");
    try {
      const { db } = await import("../firebase.js");
      const { collection, addDoc } = await import("firebase/firestore");

      const org = user.organizerProfile || {};
      await addDoc(collection(db, "bookingInquiries"), {
        // Judge
        judgeId:      judge.id,
        judgeName:    judge.name,
        judgeSlug:    judge.slug || judge.id,
        judgeClaimed: !!judge.claimedBy,
        judgeEmail:   judge.contact?.email || null,

        // Organiser
        organiserId:       user.uid,
        organiserName:     user.name,
        organiserEmail:    user.email,
        organiserVerified: user.organizerStatus === "verified",
        organiserProfile: {
          clubName: org.clubName || "",
          country:  org.country  || "",
          city:     org.city     || "",
        },

        // Show details
        showName:      f.showName.trim(),
        date:          f.date,
        location:      f.location.trim(),
        country:       f.country.trim(),
        breeds:        f.breeds.trim(),
        entries:       f.entries.trim(),
        feeDiscussion: f.feeDiscussion.trim(),
        message:       f.message.trim(),

        status:      "pending",
        submittedAt: new Date().toISOString(),
      });
      setDone(true);
    } catch(e) {
      console.error(e);
      setErr("Failed to send — please try again.");
    }
    setSending(false);
  }

  if (done) return (
    <Modal onClose={onClose} title="Request sent">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>✓</div>
        <p style={{color:T.textSub,fontSize:14,lineHeight:1.7,margin:"0 0 8px"}}>
          Your booking inquiry has been sent to <strong>{judge.name}</strong>.
        </p>
        <p style={{color:T.textHint,fontSize:13,lineHeight:1.6,margin:"0 0 20px"}}>
          {judge.claimedBy
            ? "They will receive a notification and can respond through judge.dog."
            : "We'll notify them by email. They'll need to claim their profile to respond."}
        </p>
        <Btn onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} title="Request booking" subtitle={`Send a booking inquiry to ${judge.name}`} wide>
      {/* Organiser profile summary */}
      {user.organizerProfile?.clubName && (
        <div style={{padding:"10px 14px",background:T.surface,borderRadius:T.rsm,border:`1px solid ${T.border}`,marginBottom:16,fontSize:13,color:T.textSub}}>
          Sending as <strong>{user.organizerProfile.clubName}</strong>
          {user.organizerStatus==="verified"
            ? <span style={{marginLeft:8,padding:"1px 7px",borderRadius:100,background:T.greenLight,color:T.green,fontSize:11,fontWeight:600}}>✓ Verified</span>
            : <span style={{marginLeft:8,padding:"1px 7px",borderRadius:100,background:"#fff8e1",color:"#f57f17",fontSize:11,fontWeight:600}}>Unverified</span>
          }
        </div>
      )}

      <datalist id="country-list-booking">
        {COUNTRIES.map(c=><option key={c} value={c}/>)}
      </datalist>

      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:12}}>
        <Field label="Show / Event name *"   value={f.showName}  onChange={e=>set("showName",e.target.value)}  error={touched&&!f.showName.trim()}/>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Field label="Date *" type="date" value={f.date} onChange={e=>set("date",e.target.value)} error={touched&&!f.date} style={{flex:"1 1 140px"}}/>
          <Field label="Expected entries" value={f.entries} onChange={e=>set("entries",e.target.value)} placeholder="Approx. number" style={{flex:"1 1 140px"}}/>
        </div>
        <Field label="City / Venue *"        value={f.location}  onChange={e=>set("location",e.target.value)}  error={touched&&!f.location.trim()}/>
        <Field label="Country *"             value={f.country}   onChange={e=>set("country",e.target.value)}   error={touched&&!f.country.trim()} placeholder="Start typing…" list="country-list-booking"/>
        <Field label="Breeds / disciplines *" value={f.breeds}   onChange={e=>set("breeds",e.target.value)}   error={touched&&!f.breeds.trim()} placeholder="e.g. Hound Group, German Shepherd"/>
      </div>
      <Field label="Fee & travel" value={f.feeDiscussion} onChange={e=>set("feeDiscussion",e.target.value)}
        placeholder="Budget, travel covered, accommodation…" style={{marginBottom:12}}/>
      <Field label="Message" multiline rows={3} value={f.message} onChange={e=>set("message",e.target.value)}
        style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit} disabled={sending}>{sending?"Sending…":"Send booking inquiry"}</Btn>
    </Modal>
  );
}
