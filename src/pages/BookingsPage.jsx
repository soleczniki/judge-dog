import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { T } from "../theme.js";
import { Btn, Field } from "../components/atoms.jsx";
import { Avatar } from "../components/atoms.jsx";

function StatusBadge({ status, hasConflict }) {
  const cfg = {
    pending:  { bg:"#fff8e1", color:"#f57f17", label:"Pending" },
    accepted: { bg:T.greenLight, color:T.green, label:"Accepted" },
    declined: { bg:T.redLight, color:T.red, label:"Declined" },
  }[status] || { bg:T.surface, color:T.textHint, label:status };
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 10px",borderRadius:100,fontSize:12,fontWeight:600,background:cfg.bg,color:cfg.color}}>
      {hasConflict && <span title="Calendar conflict">⚠️</span>}
      {cfg.label}
    </span>
  );
}

function InquiryCard({ inq, isJudge, onAccept, onDecline }) {
  const [expanded, setExpanded] = useState(false);
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "";

  return (
    <div style={{background:T.bg,border:`1px solid ${inq.hasConflict&&inq.status==="pending"?"#f59e0b":T.border}`,borderRadius:T.r,padding:"18px 20px",marginBottom:12,boxShadow:T.shadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:15,fontWeight:500,color:T.text}}>
              {isJudge ? inq.organiserProfile?.clubName || inq.organiserName : inq.judgeName}
            </span>
            {isJudge && inq.organiserVerified && (
              <span style={{padding:"1px 7px",borderRadius:100,background:T.greenLight,color:T.green,fontSize:11,fontWeight:600}}>✓ Verified</span>
            )}
            {isJudge && !inq.organiserVerified && (
              <span style={{padding:"1px 7px",borderRadius:100,background:"#fff8e1",color:"#f57f17",fontSize:11,fontWeight:600}}>Unverified</span>
            )}
          </div>
          <div style={{fontSize:13,color:T.textSub}}>
            <strong>{inq.showName}</strong> · {fmtDate(inq.dateFrom)}{inq.dateTo!==inq.dateFrom?` – ${fmtDate(inq.dateTo)}`:""} · {inq.location}{inq.country?`, ${inq.country}`:""}
          </div>
          <div style={{fontSize:12,color:T.textHint,marginTop:3}}>
            {inq.organisation} · {inq.discipline}
            {inq.breeds?.length>0 && ` · ${Array.isArray(inq.breeds)?inq.breeds.slice(0,3).join(", ")+(inq.breeds.length>3?` +${inq.breeds.length-3}`:""):inq.breeds}`}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
          <StatusBadge status={inq.status} hasConflict={inq.hasConflict}/>
          <span style={{fontSize:11,color:T.textHint}}>{fmtDate(inq.submittedAt)}</span>
        </div>
      </div>

      {/* Conflict warning */}
      {inq.hasConflict && inq.status==="pending" && (
        <div style={{marginTop:12,padding:"8px 12px",background:"#fff8e1",border:"1px solid #fcd34d",borderRadius:T.rsm,fontSize:13,color:"#92400e",display:"flex",alignItems:"center",gap:6}}>
          ⚠️ Your calendar shows you as busy on these dates.
        </div>
      )}

      {/* Judge response */}
      {inq.judgeResponse && (
        <div style={{marginTop:12,padding:"10px 14px",background:T.surface,borderRadius:T.rsm,borderLeft:`3px solid ${inq.status==="accepted"?T.green:T.red}`,fontSize:13,color:T.textSub,lineHeight:1.6}}>
          <span style={{fontWeight:500,color:T.text}}>Judge's response: </span>{inq.judgeResponse}
        </div>
      )}

      {/* Expand details */}
      <button type="button" onClick={()=>setExpanded(!expanded)}
        style={{marginTop:10,background:"none",border:"none",cursor:"pointer",fontSize:12,color:T.accent,fontFamily:"inherit",padding:0}}>
        {expanded?"▲ Hide details":"▼ Show details"}
      </button>

      {expanded && (
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6,fontSize:13,color:T.textSub}}>
          {inq.fee && <div><strong>Fee:</strong> {inq.fee} {inq.currency}</div>}
          {inq.travelCovered && <div><strong>Travel:</strong> {inq.travelCovered}</div>}
          {inq.accommodationCovered && <div><strong>Accommodation:</strong> {inq.accommodationCovered}</div>}
          {inq.specialRequirements && <div><strong>Special requirements:</strong> {inq.specialRequirements}</div>}
          {inq.message && <div><strong>Message:</strong> {inq.message}</div>}
          {isJudge && <div><strong>Organiser email:</strong> {inq.organiserEmail}</div>}
        </div>
      )}

      {/* Actions for judge on pending inquiries */}
      {isJudge && inq.status==="pending" && (
        <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
          <Btn small onClick={()=>onAccept(inq)} color={T.green}>Accept</Btn>
          <Btn small onClick={()=>onDecline(inq)} variant="outlined">Decline</Btn>
        </div>
      )}

      {/* iCal export for accepted bookings */}
      {inq.status==="accepted" && (
        <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
          <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(inq.showName)}&dates=${inq.dateFrom.replace(/-/g,"")}/${inq.dateTo.replace(/-/g,"")}&location=${encodeURIComponent((inq.location||"")+(inq.country?", "+inq.country:""))}&details=${encodeURIComponent("Booking via judge.dog")}`}
            target="_blank" rel="noreferrer"
            style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:100,border:`1px solid ${T.border}`,background:T.surface,color:T.textSub,fontSize:12,textDecoration:"none",fontFamily:"inherit"}}>
            📅 Add to Google Calendar
          </a>
        </div>
      )}
    </div>
  );
}

function RespondModal({ inq, type, onClose, onSubmit }) {
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const isAccept = type === "accept";

  async function submit() {
    setSaving(true);
    await onSubmit(inq.id, type, response.trim());
    setSaving(false);
    onClose();
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.38)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg,borderRadius:T.rlg,width:"100%",maxWidth:440,padding:24,boxShadow:T.shadowLg}}>
        <h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:400,color:T.text}}>
          {isAccept?"Accept booking inquiry":"Decline booking inquiry"}
        </h3>

        {inq.hasConflict && isAccept && (
          <div style={{padding:"10px 14px",background:"#fff8e1",border:"1px solid #fcd34d",borderRadius:T.rsm,fontSize:13,color:"#92400e",marginBottom:14,lineHeight:1.6}}>
            ⚠️ <strong>Your calendar shows you as busy on these dates.</strong> Both entries will remain visible in your calendar if you accept. Make sure you can fulfil this commitment.
          </div>
        )}

        <p style={{margin:"0 0 14px",fontSize:13,color:T.textSub,lineHeight:1.6}}>
          {isAccept
            ? `Accepting the inquiry from ${inq.organiserProfile?.clubName||inq.organiserName} for ${inq.showName}.`
            : `Declining the inquiry from ${inq.organiserProfile?.clubName||inq.organiserName} for ${inq.showName}.`}
        </p>

        <Field label={`Response to organiser ${isAccept?"(optional)":"(optional — explain why)"}`}
          multiline rows={3} value={response} onChange={e=>setResponse(e.target.value)}
          placeholder={isAccept?"Any details about logistics, confirmation notes…":"Feel free to suggest alternative dates or explain why…"}
          style={{marginBottom:16}}/>

        <div style={{display:"flex",gap:8}}>
          <Btn onClick={submit} disabled={saving} color={isAccept?T.green:T.red} fullWidth>
            {saving?(isAccept?"Accepting…":"Declining…"):(isAccept?"Confirm Accept":"Confirm Decline")}
          </Btn>
          <Btn onClick={onClose} variant="outlined" small>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

export function BookingsPage({ user }) {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState(user.organizerStatus ? "organiser" : "judge");
  const [respondTo, setRespondTo] = useState(null);
  const [respondType, setRespondType] = useState(null);

  const isJudge     = user.role === "judge" && user.judgeId;
  const isOrganiser = !!user.organizerStatus;

  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const { db } = await import("../firebase.js");
        const { collection, query, where, onSnapshot, orderBy } = await import("firebase/firestore");

        const q = tab === "judge"
          ? query(collection(db,"bookingInquiries"), where("judgeId","==",user.judgeId), orderBy("submittedAt","desc"))
          : query(collection(db,"bookingInquiries"), where("organiserId","==",user.uid), orderBy("submittedAt","desc"));

        unsub = onSnapshot(q, snap => {
          setInquiries(snap.docs.map(d=>({id:d.id,...d.data()})));
          setLoading(false);
        }, () => setLoading(false));
      } catch(e) { setLoading(false); }
    })();
    return () => unsub?.();
  }, [tab, user.judgeId, user.uid]);

  async function handleRespond(inquiryId, type, response) {
    try {
      const { db } = await import("../firebase.js");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db,"bookingInquiries",inquiryId), {
        status: type === "accept" ? "accepted" : "declined",
        judgeResponse: response || null,
        respondedAt: new Date().toISOString(),
        organiserRead: false,
        ...(type==="accept" ? {acceptedWithConflict: inquiries.find(i=>i.id===inquiryId)?.hasConflict||false} : {}),
      });
    } catch(e) { console.error(e); }
  }

  const pending  = inquiries.filter(i=>i.status==="pending").length;
  const unread   = tab==="organiser" ? inquiries.filter(i=>i.status!=="pending"&&i.organiserRead===false).length : pending;

  return (
    <div style={{maxWidth:760,margin:"0 auto",padding:"32px 20px 80px"}}>
      <h1 style={{margin:"0 0 4px",fontSize:26,fontWeight:400,color:T.text,letterSpacing:-0.5}}>My Bookings</h1>
      <p style={{margin:"0 0 24px",fontSize:14,color:T.textSub}}>
        {tab==="judge"?"Incoming booking inquiries from show organisers":"Booking inquiries you have sent to judges"}
      </p>

      {/* Tab switcher — shown when user has both roles */}
      {isJudge && isOrganiser && (
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {[["judge","As judge"],["organiser","As organiser"]].map(([v,l])=>(
            <button key={v} type="button" onClick={()=>setTab(v)}
              style={{padding:"7px 18px",borderRadius:100,border:`1.5px solid ${tab===v?T.accent:T.border}`,background:tab===v?T.accentLight:T.bg,color:tab===v?T.accent:T.textSub,fontSize:13,fontWeight:tab===v?600:400,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Status filter */}
      {inquiries.length > 0 && (
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
          {["all","pending","accepted","declined"].map(s=>{
            const count = s==="all"?inquiries.length:inquiries.filter(i=>i.status===s).length;
            return (
              <button key={s} type="button"
                style={{padding:"4px 12px",borderRadius:100,border:`1px solid ${T.border}`,background:T.surface,color:T.textSub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                {s.charAt(0).toUpperCase()+s.slice(1)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <p style={{color:T.textHint,fontSize:14}}>Loading…</p>
      ) : inquiries.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 0",color:T.textHint}}>
          <div style={{fontSize:36,marginBottom:12}}>📋</div>
          <p style={{fontSize:15,color:T.textSub,margin:"0 0 6px",fontWeight:500}}>No booking inquiries yet</p>
          <p style={{fontSize:13,color:T.textHint,margin:0}}>
            {tab==="judge"
              ? "Booking inquiries from organisers will appear here."
              : "Send a booking inquiry from any judge's profile to get started."}
          </p>
          {tab==="organiser" && <button onClick={()=>navigate("/")} style={{marginTop:16,padding:"9px 20px",borderRadius:100,border:`1.5px solid ${T.border}`,background:T.bg,color:T.accent,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Browse judges</button>}
        </div>
      ) : (
        inquiries.map(inq=>(
          <InquiryCard key={inq.id} inq={inq} isJudge={tab==="judge"}
            onAccept={i=>{setRespondTo(i);setRespondType("accept");}}
            onDecline={i=>{setRespondTo(i);setRespondType("decline");}}/>
        ))
      )}

      {respondTo && (
        <RespondModal inq={respondTo} type={respondType}
          onClose={()=>{setRespondTo(null);setRespondType(null);}}
          onSubmit={handleRespond}/>
      )}
    </div>
  );
}
