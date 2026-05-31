import { useState } from "react";
import { T } from "../theme.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field } from "../components/atoms.jsx";

export function AddOrganiserModal({ user, onClose, onComplete }) {
  const [clubName, setClubName] = useState("");
  const [country,  setCountry]  = useState("");
  const [city,     setCity]     = useState("");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  async function submit() {
    if (!clubName.trim()) { setErr("Please enter your organisation or club name."); return; }
    if (!country.trim())  { setErr("Please enter your country."); return; }
    if (!city.trim())     { setErr("Please enter your city."); return; }
    setSaving(true); setErr("");
    try {
      const { db } = await import("../firebase.js");
      const { doc, updateDoc } = await import("firebase/firestore");
      const update = {
        organizerStatus:  "unverified",
        organizerProfile: {
          clubName:  clubName.trim(),
          country:   country.trim(),
          city:      city.trim(),
          updatedAt: new Date().toISOString(),
        },
      };
      await updateDoc(doc(db, "users", user.uid), update);
      onComplete({ ...user, ...update });
    } catch(e) {
      console.error(e);
      setErr("Something went wrong — please try again.");
    }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title="Add Event Organiser access"
      subtitle="Send booking inquiries to judges for your shows and events">

      <div style={{padding:"12px 14px",background:T.accentLight,borderRadius:T.rsm,border:`1px solid #c5d9f7`,marginBottom:20,fontSize:13,color:T.accent,lineHeight:1.6}}>
        Once activated you can send booking inquiries immediately. A <strong>Verified Organiser</strong> badge ($2 identity check) will be available to build additional trust with judges.
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
        <Field
          label="Organisation / Club name *"
          value={clubName}
          onChange={e=>setClubName(e.target.value)}
          placeholder="e.g. Munich Dog Show Club, Midwest Agility Association"
        />
        <div style={{display:"flex",gap:10}}>
          <Field
            label="Country *"
            value={country}
            onChange={e=>setCountry(e.target.value)}
            placeholder="e.g. Germany"
            style={{flex:1}}
          />
          <Field
            label="City *"
            value={city}
            onChange={e=>setCity(e.target.value)}
            placeholder="e.g. Munich"
            style={{flex:1}}
          />
        </div>
      </div>

      {err && <div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}

      <Btn fullWidth onClick={submit} disabled={saving}>
        {saving ? "Activating…" : "Activate Organiser Access"}
      </Btn>

      <p style={{margin:"12px 0 0",fontSize:12,color:T.textHint,textAlign:"center",lineHeight:1.6}}>
        You'll be able to send booking inquiries right away. Judges will see you as an unverified organiser until you complete identity verification.
      </p>
    </Modal>
  );
}
