import { useState, useMemo } from "react";
import { T } from "../theme.js";
import { Modal } from "../components/Modal.jsx";
import { Btn, Field } from "../components/atoms.jsx";
import { CountrySelect } from "../components/CountrySelect.jsx";

// Discipline labels per org (native terminology)
const DISCIPLINES = {
  FCI: ["Shows","Field Trials & Hunting","Obedience & Rally","Agility","Tracking & Nose Work","Working & Herding","Grooming","Dog Dancing"],
  AKC: ["Conformation","Obedience & Rally","Agility","Tracking & Scent Work","Performance (Herding, Hunting, Earthdog…)","Junior Showmanship"],
  KC:  ["Conformation","Agility","Obedience","Working Trials","Heelwork to Music"],
  CKC: ["Conformation","Agility","Obedience","Rally","Herding","Tracking"],
};

const CURRENCIES = ["EUR","USD","GBP","CHF","PLN","CZK","SEK","NOK","DKK","AUD","CAD","Other"];

function BreedSelect({ judge, selected, onChange }) {
  const [search, setSearch] = useState("");

  const breeds = useMemo(() => {
    if (judge.allBreedJudge) return null; // free text
    const approved = (judge.authorizedBreeds||[]);
    const fromBreeds = (judge.breeds||[]).map(b => ({name:b, status:"Approved"}));
    // Merge, deduplicate
    const map = {};
    fromBreeds.forEach(b => { map[b.name] = b; });
    approved.forEach(b => { map[b.name] = b; });
    return Object.values(map).sort((a,b) => a.name.localeCompare(b.name));
  }, [judge]);

  if (!breeds || breeds.length === 0) {
    return (
      <Field label="Breeds / classes" value={search}
        onChange={e=>{ setSearch(e.target.value); onChange(e.target.value); }}
        placeholder="e.g. German Shepherd Dog, Hound Group"/>
    );
  }

  const filtered = search
    ? breeds.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : breeds;

  function toggle(name) {
    const next = selected.includes(name)
      ? selected.filter(s=>s!==name)
      : [...selected, name];
    onChange(next);
  }

  return (
    <div>
      <label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2,display:"block",marginBottom:4}}>
        Breeds / classes *
      </label>
      {selected.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
          {selected.map(b=>(
            <span key={b} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:100,background:T.accentLight,color:T.accent,fontSize:12,fontWeight:500,border:`1px solid #c5d9f7`}}>
              {b}
              <button type="button" onClick={()=>toggle(b)}
                style={{background:"none",border:"none",cursor:"pointer",color:T.accent,fontSize:14,lineHeight:1,padding:0,marginLeft:2}}>×</button>
            </span>
          ))}
        </div>
      )}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter breeds…"
        style={{width:"100%",padding:"8px 12px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:13,fontFamily:"inherit",background:T.surface,outline:"none",color:T.text,boxSizing:"border-box",marginBottom:6}}
        onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
      <div style={{maxHeight:160,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:T.rsm,background:T.bg}}>
        {filtered.length === 0
          ? <p style={{margin:0,padding:"10px 12px",fontSize:13,color:T.textHint}}>No matches</p>
          : filtered.map(b=>(
            <label key={b.name} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,fontSize:13,color:T.text,background:selected.includes(b.name)?T.accentLight:"transparent",transition:"background .1s"}}>
              <input type="checkbox" checked={selected.includes(b.name)} onChange={()=>toggle(b.name)}
                style={{width:14,height:14,accentColor:T.accent,flexShrink:0,cursor:"pointer"}}/>
              <span style={{flex:1}}>{b.name}</span>
              {b.status==="Provisional"&&<span style={{fontSize:10,fontWeight:700,color:"#b45309",background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:4,padding:"0 4px",lineHeight:"16px"}}>PROV</span>}
            </label>
          ))
        }
      </div>
    </div>
  );
}

export function BookingModal({ judge, user, onClose }) {
  const judgeOrgs = (judge.orgs||[]).map(o=>o.org);
  const defaultOrg = judgeOrgs[0] || "";

  const [org,          setOrg]      = useState(defaultOrg);
  const [discipline,   setDisc]     = useState("");
  const [breeds,       setBreeds]   = useState([]);
  const [dateFrom,     setDateFrom] = useState("");
  const [dateTo,       setDateTo]   = useState("");
  const [location,     setLocation] = useState("");
  const [country,      setCountry]  = useState(user.organizerProfile?.country||"");
  const [fee,          setFee]      = useState("");
  const [currency,     setCurrency] = useState("EUR");
  const [travel,       setTravel]   = useState("");
  const [accommodation,setAccom]    = useState("");
  const [requirements, setReq]      = useState("");
  const [message,      setMessage]  = useState("");
  const [done,         setDone]     = useState(false);
  const [err,          setErr]      = useState("");
  const [sending,      setSending]  = useState(false);
  const [touched,      setTouched]  = useState(false);

  const disciplines = DISCIPLINES[org] || [];

  async function submit() {
    setTouched(true);
    const breedsOk = Array.isArray(breeds) ? breeds.length > 0 : (breeds||"").trim().length > 0;
    if (!dateFrom||!dateTo||!location.trim()||!discipline||!breedsOk) {
      setErr("Please fill in all required fields.");
      return;
    }
    setSending(true); setErr("");
    try {
      const { db } = await import("../firebase.js");
      const { collection, addDoc, query, where, getDocs } = await import("firebase/firestore");
      const orgProfile = user.organizerProfile || {};

      // Check for date conflicts with existing accepted bookings
      let hasConflict = false;
      try {
        const conflicts = await getDocs(query(
          collection(db,"bookingInquiries"),
          where("judgeId","==",judge.id),
          where("status","==","accepted")
        ));
        hasConflict = conflicts.docs.some(d => {
          const b = d.data();
          return b.dateFrom <= dateTo && b.dateTo >= dateFrom;
        });
      } catch(e) {}

      await addDoc(collection(db, "bookingInquiries"), {
        judgeId: judge.id, judgeName: judge.name, judgeSlug: judge.slug||judge.id,
        judgeClaimed: !!judge.claimedBy, judgeEmail: judge.contact?.email||null,
        organiserId: user.uid, organiserName: user.name, organiserEmail: user.email,
        organiserVerified: user.organizerStatus === "verified",
        organiserProfile: { clubName: orgProfile.clubName||"", country: orgProfile.country||"", city: orgProfile.city||"" },
        organisation: org,
        discipline,
        breeds: Array.isArray(breeds) ? breeds : [breeds],
        dateFrom, dateTo,
        location: location.trim(),
        country,
        fee: fee.trim(), currency,
        travelCovered: travel,
        accommodationCovered: accommodation,
        specialRequirements: requirements.trim(),
        message: message.trim(),
        status: "pending",
        hasConflict,
        organiserRead: false,
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
    <Modal onClose={onClose} title="Inquiry sent">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>✓</div>
        <p style={{color:T.textSub,fontSize:14,lineHeight:1.7,margin:"0 0 8px"}}>
          Your booking inquiry has been sent to <strong>{judge.name}</strong>.
        </p>
        <p style={{color:T.textHint,fontSize:13,lineHeight:1.6,margin:"0 0 20px"}}>
          {judge.claimedBy ? "They will be notified and can respond through judge.dog." : "We'll notify them by email. They'll need to claim their profile to respond."}
        </p>
        <Btn onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );

  const RadioGroup = ({label, value, onChange, options}) => (
    <div>
      <label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2,display:"block",marginBottom:6}}>{label}</label>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {options.map(o=>(
          <button key={o} type="button" onClick={()=>onChange(o)}
            style={{padding:"7px 14px",borderRadius:100,border:`1.5px solid ${value===o?T.accent:T.border}`,background:value===o?T.accentLight:T.bg,color:value===o?T.accent:T.textSub,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Modal onClose={onClose} title="Request booking" subtitle={`Booking inquiry to ${judge.name}`} wide>

      {/* Organiser badge */}
      {user.organizerProfile?.clubName && (
        <div style={{padding:"9px 14px",background:T.surface,borderRadius:T.rsm,border:`1px solid ${T.border}`,marginBottom:16,fontSize:13,color:T.textSub,display:"flex",alignItems:"center",gap:8}}>
          <span>Sending as <strong>{user.organizerProfile.clubName}</strong></span>
          {user.organizerStatus==="verified"
            ? <span style={{padding:"1px 7px",borderRadius:100,background:T.greenLight,color:T.green,fontSize:11,fontWeight:600}}>✓ Verified</span>
            : <span style={{padding:"1px 7px",borderRadius:100,background:"#fff8e1",color:"#f57f17",fontSize:11,fontWeight:600}}>Unverified</span>}
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* Organisation + Discipline */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 140px"}}>
            <label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2,display:"block",marginBottom:4}}>Organisation *</label>
            <select value={org} onChange={e=>{setOrg(e.target.value);setDisc("");setBreeds([]);}}
              style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${touched&&!org?T.red:T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:T.bg,color:T.text,outline:"none",boxSizing:"border-box"}}>
              <option value="">Select…</option>
              {judgeOrgs.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{flex:"2 1 200px"}}>
            <label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2,display:"block",marginBottom:4}}>Discipline *</label>
            <select value={discipline} onChange={e=>setDisc(e.target.value)} disabled={!org}
              style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${touched&&!discipline?T.red:T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:!org?T.surface:T.bg,color:T.text,outline:"none",boxSizing:"border-box"}}>
              <option value="">Select discipline…</option>
              {disciplines.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Breeds — shown after discipline selected */}
        {discipline && (
          <BreedSelect judge={judge} selected={Array.isArray(breeds)?breeds:[]} onChange={setBreeds}/>
        )}

        {/* Date range */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Field label="Date from *" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} error={touched&&!dateFrom} style={{flex:"1 1 140px"}}/>
          <Field label="Date to *"   type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   error={touched&&!dateTo}   style={{flex:"1 1 140px"}}/>
        </div>

        {/* Location */}
        <Field label="City / Venue *" value={location} onChange={e=>setLocation(e.target.value)} error={touched&&!location.trim()} placeholder="e.g. Munich Fairgrounds"/>
        <CountrySelect label="Country" value={country} onChange={setCountry}/>

        {/* Fee */}
        <div>
          <label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2,display:"block",marginBottom:4}}>Judge fee</label>
          <div style={{display:"flex",gap:8}}>
            <input value={fee} onChange={e=>setFee(e.target.value)} placeholder="Amount"
              style={{flex:1,padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:T.bg,outline:"none",color:T.text}}
              onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
            <select value={currency} onChange={e=>setCurrency(e.target.value)}
              style={{width:90,padding:"10px 10px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:T.bg,color:T.text,outline:"none"}}>
              {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <RadioGroup label="Travel" value={travel} onChange={setTravel} options={["Covered","Partial","Not covered"]}/>
        <RadioGroup label="Accommodation" value={accommodation} onChange={setAccom} options={["Covered","Not covered"]}/>

        <Field label="Special requirements" value={requirements} onChange={e=>setReq(e.target.value)} placeholder="Visa letter, special dietary needs, etc." multiline rows={2}/>
        <Field label="Message" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Anything else you'd like to add…" multiline rows={3}/>

      </div>

      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,margin:"14px 0"}}>{err}</div>}
      <div style={{marginTop:16}}>
        <Btn fullWidth onClick={submit} disabled={sending}>{sending?"Sending…":"Send booking inquiry"}</Btn>
      </div>
    </Modal>
  );
}
