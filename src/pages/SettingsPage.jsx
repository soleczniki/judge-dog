import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { T } from "../theme.js";
import { Btn, Field } from "../components/atoms.jsx";
import { uploadUserPhoto } from "../firebase.js";

function Section({ title, children }) {
  return (
    <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:T.r,marginBottom:16,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,background:T.surface}}>
        <span style={{fontSize:12,fontWeight:700,color:T.textHint,textTransform:"uppercase",letterSpacing:1}}>{title}</span>
      </div>
      <div style={{padding:"20px"}}>{children}</div>
    </div>
  );
}

function Row({ label, value, hint }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
      <div>
        <div style={{fontSize:14,color:T.text,fontWeight:500}}>{label}</div>
        {hint&&<div style={{fontSize:12,color:T.textHint,marginTop:2}}>{hint}</div>}
      </div>
      <div style={{fontSize:14,color:T.textSub,textAlign:"right",maxWidth:"60%"}}>{value}</div>
    </div>
  );
}

function RoleBadge({ label, active, colour="#1a73e8" }) {
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:100,fontSize:12,fontWeight:600,
      background:active?`${colour}18`:"transparent",
      color:active?colour:T.textHint,
      border:`1.5px solid ${active?colour:T.border}`,
    }}>
      {active ? "✓ " : ""}{label}
    </span>
  );
}

export function SettingsPage({ user, onUserUpdated }) {
  const navigate = useNavigate();
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [err,            setErr]            = useState("");
  const [touched,        setTouched]        = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview,   setPhotoPreview]   = useState(user.profilePhoto || user.photo || null);
  const [photoErr,       setPhotoErr]       = useState("");

  // Organiser profile fields
  const org = user.organizerProfile || {};
  const [clubName, setClubName] = useState(org.clubName || "");
  const [country,  setCountry]  = useState(org.country  || "");
  const [city,     setCity]     = useState(org.city      || "");
  const [phone,    setPhone]    = useState(org.phone     || "");
  const [website,  setWebsite]  = useState(org.website   || "");

  const isOrganiser    = !!user.organizerStatus;
  const isOwnerHandler = user.isOwnerHandler !== false;
  const isJudge        = user.role === "judge";

  async function saveOrganiserProfile() {
    setTouched(true);
    if (!clubName.trim() || !country.trim() || !city.trim()) {
      setErr("Please fill in all required fields (marked with *).");
      return;
    }
    setSaving(true); setErr(""); setSaved(false);
    try {
      const { db } = await import("../firebase.js");
      const { doc, updateDoc } = await import("firebase/firestore");
      const update = {
        organizerProfile: {
          clubName: clubName.trim(),
          country:  country.trim(),
          city:     city.trim(),
          phone:    phone.trim(),
          website:  website.trim(),
          updatedAt: new Date().toISOString(),
        },
      };
      await updateDoc(doc(db, "users", user.uid), update);
      onUserUpdated?.({ ...user, ...update });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) {
      setErr("Failed to save — please try again.");
    }
    setSaving(false);
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoErr("Photo must be under 5 MB."); return; }
    setPhotoUploading(true); setPhotoErr("");
    try {
      const preview = URL.createObjectURL(file);
      setPhotoPreview(preview);
      const url = await uploadUserPhoto(user.uid, file);
      onUserUpdated?.({ ...user, profilePhoto: url });
    } catch(e) {
      setPhotoErr("Upload failed — please try again.");
      setPhotoPreview(user.profilePhoto || user.photo || null);
    }
    setPhotoUploading(false);
  }

  async function addOwnerHandler() {
    try {
      const { db } = await import("../firebase.js");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "users", user.uid), { isOwnerHandler: true });
      onUserUpdated?.({ ...user, isOwnerHandler: true });
    } catch(e) { setErr("Failed — please try again."); }
  }

  async function addOrganiserRole() {
    navigate("/?openAddOrganiser=1");
  }

  return (
    <div style={{maxWidth:640,margin:"0 auto",padding:"36px 20px 80px"}}>
      <h1 style={{margin:"0 0 6px",fontSize:26,fontWeight:400,color:T.text,letterSpacing:-0.5}}>Account settings</h1>
      <p style={{margin:"0 0 28px",fontSize:14,color:T.textSub}}>Manage your profile and roles</p>

      {/* Personal */}
      <Section title="Personal">
        <Row label="Name" value={user.name} hint="Set by your Google account"/>
        <Row label="Email" value={user.email} hint="Set by your Google account"/>
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"12px 0"}}>
          <div style={{position:"relative",flexShrink:0}}>
            {photoPreview
              ? <img src={photoPreview} style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:`1px solid ${T.border}`}} alt=""/>
              : <div style={{width:60,height:60,borderRadius:"50%",background:T.surface,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:T.textHint}}>?</div>
            }
            {photoUploading&&<div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(255,255,255,.7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.textSub}}>…</div>}
          </div>
          <div>
            <div style={{fontSize:14,color:T.text,fontWeight:500,marginBottom:6}}>Profile photo</div>
            <label style={{cursor:"pointer",padding:"6px 14px",borderRadius:100,border:`1px solid ${T.border}`,background:T.surface,fontSize:13,fontWeight:500,color:T.text,fontFamily:"inherit",display:"inline-block"}}>
              {photoUploading ? "Uploading…" : "Change photo"}
              <input type="file" accept="image/*" style={{display:"none"}} disabled={photoUploading} onChange={handlePhotoUpload}/>
            </label>
            {photoErr&&<div style={{fontSize:12,color:T.red,marginTop:4}}>{photoErr}</div>}
            <div style={{fontSize:12,color:T.textHint,marginTop:4}}>Max 5 MB · JPG or PNG</div>
          </div>
        </div>
      </Section>

      {/* Roles */}
      <Section title="Your roles">
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          <RoleBadge label="Owner / Handler" active={isOwnerHandler}/>
          <RoleBadge label="Event Organiser" active={isOrganiser} colour="#1e8e3e"/>
          {isJudge&&<RoleBadge label="Judge" active={true} colour="#9334e6"/>}
        </div>

        {!isOwnerHandler&&(
          <div style={{padding:"14px",background:T.surface,borderRadius:T.rsm,border:`1px solid ${T.border}`,marginBottom:10}}>
            <p style={{margin:"0 0 10px",fontSize:13,color:T.textSub}}>Add the Owner / Handler role to research judges and write reviews from your experience competing.</p>
            <Btn small onClick={addOwnerHandler}>Add Owner / Handler role</Btn>
          </div>
        )}

        {!isOrganiser&&(
          <div style={{padding:"14px",background:T.surface,borderRadius:T.rsm,border:`1px solid ${T.border}`}}>
            <p style={{margin:"0 0 10px",fontSize:13,color:T.textSub}}>Add the Event Organiser role to send booking inquiries to judges for your shows and events.</p>
            <Btn small onClick={addOrganiserRole}>Add Event Organiser role</Btn>
          </div>
        )}

        {isOrganiser&&(
          <div style={{fontSize:13,color:T.textSub,display:"flex",alignItems:"center",gap:6}}>
            <span style={{
              padding:"2px 8px",borderRadius:100,fontSize:11,fontWeight:600,
              background: user.organizerStatus==="verified"?"#e6f4ea":"#fff8e1",
              color: user.organizerStatus==="verified"?"#1e8e3e":"#f57f17",
              border:`1px solid ${user.organizerStatus==="verified"?"#a8d5b5":"#ffe082"}`,
            }}>
              {user.organizerStatus==="verified"?"✓ Verified Organiser":"Unverified Organiser"}
            </span>
            {user.organizerStatus!=="verified"&&<span style={{color:T.textHint}}>Identity verification coming soon</span>}
          </div>
        )}
      </Section>

      {/* Organiser Profile */}
      {isOrganiser&&(
        <Section title="Organiser profile">
          <p style={{margin:"0 0 16px",fontSize:13,color:T.textSub,lineHeight:1.6}}>
            This information is shown to judges when you send a booking inquiry.
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Field label="Organisation / Club name *" value={clubName} onChange={e=>setClubName(e.target.value)}
              placeholder="e.g. Munich Dog Show Club" error={touched&&!clubName.trim()}/>
            <div style={{display:"flex",gap:10}}>
              <Field label="Country *" value={country} onChange={e=>setCountry(e.target.value)}
                placeholder="e.g. Germany" style={{flex:1}} error={touched&&!country.trim()}/>
              <Field label="City *" value={city} onChange={e=>setCity(e.target.value)}
                placeholder="e.g. Munich" style={{flex:1}} error={touched&&!city.trim()}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <Field label="Phone" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+49 89 123456" style={{flex:1}}/>
              <Field label="Website" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://yourclub.com" style={{flex:1}}/>
            </div>
          </div>
          {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginTop:12}}>{err}</div>}
          <div style={{marginTop:16,display:"flex",alignItems:"center",gap:12}}>
            <Btn onClick={saveOrganiserProfile} disabled={saving}>{saving?"Saving…":"Save organiser profile"}</Btn>
            {saved&&<span style={{fontSize:13,color:T.green}}>✓ Saved</span>}
          </div>
        </Section>
      )}

      {/* Judge profile link */}
      {isJudge&&(
        <Section title="Judge profile">
          <p style={{margin:"0 0 12px",fontSize:13,color:T.textSub}}>You have a claimed judge profile. Edit your bio, headline, and photos there.</p>
          <Btn onClick={()=>navigate(`/judge/${user.judgeId}`)} variant="outlined">View my judge profile →</Btn>
        </Section>
      )}
    </div>
  );
}
