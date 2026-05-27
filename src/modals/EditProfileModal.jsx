import { useState } from "react";
import { T } from "../theme.js";
import { withTimeout } from "../utils.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field, Avatar } from "../components/atoms.jsx";

export function EditProfileModal({judge,onClose,onSave}) {
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [photoFile,setPhotoFile]=useState(null);
  const [photoPreview,setPhotoPreview]=useState(judge.profilePhoto||null);
  const [headline,setHeadline]=useState(judge.headline||"");
  const [bio,setBio]=useState(judge.bio||"");
  const [highlights,setHighlights]=useState(judge.highlights||[]);
  const [newHL,setNewHL]=useState("");
  const [ig,setIg]=useState(judge.social?.instagram||"");
  const [fb,setFb]=useState(judge.social?.facebook||"");
  const [li,setLi]=useState(judge.social?.linkedin||"");
  const [web,setWeb]=useState(judge.social?.website||"");
  const [gallery,setGallery]=useState(judge.galleryPhotos||[]);
  const [galleryBusy,setGalleryBusy]=useState(false);
  const [uploadErr,setUploadErr]=useState("");

  const mark=fn=>(...args)=>{fn(...args);setDirty(true);};
  const addHL=()=>{ if(!newHL.trim()) return; setHighlights(h=>[...h,newHL.trim()]); setNewHL(""); setDirty(true); };

  const handleGalleryAdd=async e=>{
    const files=Array.from(e.target.files); if(!files.length) return;
    setGalleryBusy(true); setUploadErr("");
    try {
      const {uploadPhoto}=await import("../firebase.js");
      const urls=await Promise.all(files.map((f,i)=>
        withTimeout(uploadPhoto(judge.id,f,`gallery-${i}`),20000,
          "Upload timed out — make sure Firebase Storage is enabled and rules allow writes.")
      ));
      setGallery(g=>[...g,...urls].slice(0,8));
      setDirty(true);
    } catch(err){
      console.error("Gallery upload failed:", err);
      setUploadErr(err?.message||"Upload failed — check Firebase Storage is enabled.");
    }
    setGalleryBusy(false);
    e.target.value="";
  };

  const [saveErr,setSaveErr]=useState("");
  const save=async()=>{
    setSaving(true); setSaveErr("");
    try {
      let profilePhoto=judge.profilePhoto||null;
      if(photoFile){
        const {uploadPhoto}=await import("../firebase.js");
        profilePhoto=await uploadPhoto(judge.id,photoFile,"profile");
      }
      await onSave({...judge,profilePhoto,headline,bio,highlights,galleryPhotos:gallery,
        social:{instagram:ig,facebook:fb,linkedin:li,website:web}});
      onClose();
    } catch(err){
      console.error("Save failed:", err);
      setSaveErr(err?.message||"Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Edit profile" subtitle="Changes are visible on your public profile" wide confirmClose={dirty&&!saving}>
      {/* Photo */}
      <p style={{fontSize:12,fontWeight:600,color:T.textSub,letterSpacing:.4,textTransform:"uppercase",margin:"0 0 10px"}}>Profile photo</p>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22}}>
        <Avatar label={judge.photo} photoUrl={photoPreview} size={72}/>
        <label onClick={e=>e.stopPropagation()} style={{cursor:"pointer",padding:"8px 18px",borderRadius:100,border:`1px solid ${T.border}`,background:T.surface,fontSize:13,fontWeight:500,color:T.text,fontFamily:"inherit"}}>
          Upload photo
          <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){setPhotoFile(f);setPhotoPreview(URL.createObjectURL(f));setDirty(true);}}}/>
        </label>
      </div>

      {/* About */}
      <p style={{fontSize:12,fontWeight:600,color:T.textSub,letterSpacing:.4,textTransform:"uppercase",margin:"0 0 10px"}}>About you</p>
      <Field label="Headline" value={headline} onChange={mark(e=>setHeadline(e.target.value))} placeholder="e.g. FCI All-Breed Judge · 30 years experience" style={{marginBottom:10}}/>
      <Field label="Bio" multiline rows={4} value={bio} onChange={mark(e=>setBio(e.target.value))} placeholder="Your background, philosophy, what you look for…" style={{marginBottom:22}}/>

      {/* Highlights */}
      <p style={{fontSize:12,fontWeight:600,color:T.textSub,letterSpacing:.4,textTransform:"uppercase",margin:"0 0 10px"}}>Career highlights</p>
      <div style={{marginBottom:22}}>
        {highlights.map((h,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{flex:1,fontSize:13,color:T.text,padding:"7px 12px",background:T.surface,borderRadius:T.rsm,border:`1px solid ${T.border}`}}>{h}</span>
            <button onClick={()=>{setHighlights(hh=>hh.filter((_,j)=>j!==i));setDirty(true);}}
              style={{background:"none",border:"none",cursor:"pointer",color:T.textHint,fontSize:18,padding:"2px 6px",borderRadius:6,lineHeight:1,fontFamily:"inherit"}}>×</button>
          </div>
        ))}
        <div style={{display:"flex",gap:8}}>
          <input value={newHL} onChange={e=>setNewHL(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addHL();}}}
            placeholder="Add a highlight and press Enter"
            style={{flex:1,padding:"9px 13px",borderRadius:T.rsm,border:`1.5px solid ${T.border}`,fontSize:13,fontFamily:"inherit",outline:"none",color:T.text,background:T.bg}}
            onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
          <button onClick={addHL}
            style={{padding:"9px 16px",borderRadius:T.rsm,background:T.accentLight,color:T.accent,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>Add</button>
        </div>
      </div>

      {/* Social */}
      <p style={{fontSize:12,fontWeight:600,color:T.textSub,letterSpacing:.4,textTransform:"uppercase",margin:"0 0 10px"}}>Social & web</p>
      <div className="form-row" style={{marginBottom:22}}>
        <Field label="Instagram" value={ig} onChange={mark(e=>setIg(e.target.value))} placeholder="@handle"/>
        <Field label="Website" value={web} onChange={mark(e=>setWeb(e.target.value))} placeholder="https://"/>
        <Field label="Facebook" value={fb} onChange={mark(e=>setFb(e.target.value))} placeholder="Page or username"/>
        <Field label="LinkedIn" value={li} onChange={mark(e=>setLi(e.target.value))} placeholder="Username"/>
      </div>

      {/* Gallery */}
      <p style={{fontSize:12,fontWeight:600,color:T.textSub,letterSpacing:.4,textTransform:"uppercase",margin:"0 0 10px"}}>Photo gallery <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:T.textHint}}>· up to 8 photos</span></p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
        {gallery.map((url,i)=>(
          <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:T.rsm,overflow:"hidden"}}>
            <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            <button onClick={()=>{setGallery(g=>g.filter((_,j)=>j!==i));setDirty(true);}}
              style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.6)",border:"none",borderRadius:"50%",width:22,height:22,color:"#fff",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
          </div>
        ))}
        {gallery.length<8&&(
          <label onClick={e=>e.stopPropagation()} style={{aspectRatio:"1",borderRadius:T.rsm,border:`2px dashed ${galleryBusy?T.accent:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:galleryBusy?"default":"pointer",background:T.surface,position:"relative"}}>
            {galleryBusy
              ? <div style={{width:24,height:24,border:`3px solid ${T.border}`,borderTopColor:T.accent,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
              : <span style={{fontSize:24,color:T.textHint}}>+</span>
            }
            {!galleryBusy&&<input type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleGalleryAdd}/>}
          </label>
        )}
      </div>
      <p style={{fontSize:12,color:T.textHint,margin:"0 0 6px"}}>Show photos, ringside moments, awards</p>
      {uploadErr&&<div style={{fontSize:12,color:T.red,background:T.redLight,padding:"8px 12px",borderRadius:T.rsm,marginBottom:16}}>{uploadErr}</div>}

      {saveErr&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:12}}>{saveErr}</div>}
      <Btn fullWidth onClick={save} disabled={saving}>{saving?"Saving…":"Save changes"}</Btn>
    </Modal>
  );
}
