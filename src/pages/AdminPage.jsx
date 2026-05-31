import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { T } from "../theme.js";
import { initials } from "../utils.js";
import { Avatar, Btn } from "../components/atoms.jsx";

// ── Admin Dashboard ────────────────────────────────────────────────────────────
function AdminDashboard({judges,reviews,bookings,user,onBack,onUpdateUser,onRemoveReview,onVerifyJudge}) {
  const [tab,setTab]=useState("overview");
  const [allUsers,setAllUsers]=useState([]);
  const [loadingUsers,setLoadingUsers]=useState(true);
  const [claimQueue,setClaimQueue]=useState([]);
  const [allClaims,setAllClaims]=useState([]);
  const [claimsFilter,setClaimsFilter]=useState("pending");
  const [rejectingId,setRejectingId]=useState(null);
  const [rejectNote,setRejectNote]=useState("");

  useEffect(()=>{
    (async()=>{
      try {
        const {db} = await import("../firebase.js");
        const {collection,getDocs,query,where} = await import("firebase/firestore");
        // Run independently so one failure doesn't kill the other
        const [usersResult,claimsResult] = await Promise.allSettled([
          getDocs(collection(db,"users")),
          getDocs(collection(db,"claims")),
        ]);
        if(usersResult.status==="fulfilled") setAllUsers(usersResult.value.docs.map(d=>({id:d.id,...d.data()})));
        if(claimsResult.status==="fulfilled") {
          const all = claimsResult.value.docs.map(d=>({id:d.id,...d.data()}))
            .sort((a,b)=>(b.submittedAt||"").localeCompare(a.submittedAt||""));
          setAllClaims(all);
          setClaimQueue(all.filter(c=>c.status==="pending"));
        } else console.error("Claims load failed:",claimsResult.reason);
      } catch(e){ console.error(e); }
      setLoadingUsers(false);
    })();
  },[]);

  async function changeRole(uid,newRole){
    try {
      const {db} = await import("../firebase.js");
      const {doc,updateDoc} = await import("firebase/firestore");
      await updateDoc(doc(db,"users",uid),{role:newRole});
      setAllUsers(prev=>prev.map(u=>u.id===uid?{...u,role:newRole}:u));
    } catch(e){ alert("Failed to update role"); }
  }

  async function suspendUser(uid,suspended){
    try {
      const {db} = await import("../firebase.js");
      const {doc,updateDoc} = await import("firebase/firestore");
      await updateDoc(doc(db,"users",uid),{suspended});
      setAllUsers(prev=>prev.map(u=>u.id===uid?{...u,suspended}:u));
    } catch(e){ alert("Failed to update user"); }
  }

  const statCards = [
    {label:"Total Judges",value:judges.length,color:T.accent},
    {label:"Total Reviews",value:reviews.length,color:T.green},
    {label:"Total Users",value:allUsers.length,color:"#9334e6"},
    {label:"Pending Claims",value:claimQueue.length,color:T.amber},
    {label:"Bookings",value:bookings.length,color:"#e52592"},
    {label:"Verified Judges",value:judges.filter(j=>j.verified).length,color:T.green},
  ];

  const tabs = [
    {key:"overview",label:"Overview"},
    {key:"users",label:`Users (${allUsers.length})`},
    {key:"claims",label:`Claims (${claimQueue.length})`},
    {key:"reviews",label:`Reviews (${reviews.length})`},
  ];

  return (
    <div style={{minHeight:"100vh",background:T.surface}}>
      {/* Top bar */}
      <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14,fontWeight:500,padding:"6px 10px",borderRadius:100,fontFamily:"inherit"}}
            onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background="none"}>← Back</button>
          <span style={{fontSize:15,fontWeight:500,color:T.text}}>Admin Dashboard</span>
        </div>
        <span style={{fontSize:12,color:T.textHint}}>Signed in as {user.email}</span>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px"}}>
        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:24,background:T.bg,padding:4,borderRadius:T.r,border:`1px solid ${T.border}`,width:"fit-content"}}>
          {tabs.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{padding:"7px 16px",borderRadius:8,border:"none",background:tab===t.key?T.accent:"transparent",color:tab===t.key?"#fff":T.textSub,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab==="overview"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:28}}>
              {statCards.map(s=>(
                <div key={s.label} style={{background:T.bg,borderRadius:T.r,padding:"18px 20px",border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
                  <div style={{fontSize:28,fontWeight:600,color:s.color,marginBottom:4}}>{s.value}</div>
                  <div style={{fontSize:12,color:T.textHint}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:T.bg,borderRadius:T.r,padding:"20px",border:`1px solid ${T.border}`,marginBottom:20}}>
              <p style={{margin:"0 0 14px",fontSize:13,fontWeight:600,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8}}>Recent reviews</p>
              {reviews.slice(-5).reverse().map(r=>{
                const j=judges.find(j=>j.judgeId===r.judgeId)||judges.find(j=>j.id===r.judgeId);
                return(
                  <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                    <div>
                      <p style={{margin:0,fontSize:14,color:T.text,fontWeight:500}}>{r.userName} → {j?.name||"Unknown judge"}</p>
                      <p style={{margin:0,fontSize:12,color:T.textHint}}>{r.breed} · {r.show} · {r.date}</p>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13,color:T.amber}}>★ {r.overall}</span>
                      <button onClick={()=>onRemoveReview(r.id)} style={{padding:"4px 10px",borderRadius:100,border:`1px solid ${T.red}`,background:"none",color:T.red,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Users */}
        {tab==="users"&&(
          <div style={{background:T.bg,borderRadius:T.r,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:14,fontWeight:500,color:T.text}}>All users</span>
              <span style={{fontSize:12,color:T.textHint}}>{allUsers.length} total</span>
            </div>
            {loadingUsers ? (
              <div style={{padding:40,textAlign:"center",color:T.textHint,fontSize:13}}>Loading users…</div>
            ) : (
              allUsers.map((u,i)=>(
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<allUsers.length-1?`1px solid ${T.border}`:"none",flexWrap:"wrap"}}>
                  {u.photo
                    ? <img src={u.photo} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
                    : <Avatar label={initials(u.name||"?")} size={32}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:14,fontWeight:500,color:u.suspended?"#9aa0a6":T.text}}>{u.name}{u.suspended&&" (suspended)"}</p>
                    <p style={{margin:0,fontSize:12,color:T.textHint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</p>
                  </div>
                  <select value={u.role||"exhibitor"} onChange={e=>changeRole(u.id,e.target.value)}
                    style={{padding:"5px 10px",borderRadius:100,border:`1px solid ${T.border}`,background:T.surface,fontSize:12,color:T.text,cursor:"pointer",outline:"none"}}>
                    {[["exhibitor","Owner / Handler"],["organizer_unverified","Organiser (unverified)"],["organizer","Organiser"],["judge","Judge"],["admin","Admin"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                  <button onClick={()=>suspendUser(u.id,!u.suspended)}
                    style={{padding:"5px 12px",borderRadius:100,border:`1px solid ${u.suspended?T.green:T.red}`,background:"none",color:u.suspended?T.green:T.red,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {u.suspended?"Unsuspend":"Suspend"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Claims */}
        {tab==="claims"&&(()=>{
          const statusColors={pending:{bg:"#fffbe6",color:T.amber},approved:{bg:T.greenLight,color:T.green},rejected:{bg:T.redLight,color:T.red},cancelled:{bg:T.surface,color:T.textHint}};
          const displayed = claimsFilter==="all" ? allClaims : allClaims.filter(c=>c.status===claimsFilter);
          return (
            <div style={{background:T.bg,borderRadius:T.r,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:500,color:T.text}}>Profile claims</span>
                <div style={{display:"flex",gap:4}}>
                  {["pending","approved","rejected","all"].map(s=>(
                    <button key={s} onClick={()=>setClaimsFilter(s)}
                      style={{padding:"5px 13px",borderRadius:100,border:`1px solid ${claimsFilter===s?T.accent:T.border}`,background:claimsFilter===s?T.accentLight:T.bg,color:claimsFilter===s?T.accent:T.textSub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize"}}>
                      {s}{s!=="all"&&` (${allClaims.filter(c=>c.status===s).length})`}
                    </button>
                  ))}
                </div>
              </div>
              {displayed.length===0?(
                <div style={{padding:48,textAlign:"center",color:T.textHint,fontSize:13}}>No {claimsFilter==="all"?"":claimsFilter} claims</div>
              ):displayed.map((claim,i)=>{
                const sc=statusColors[claim.status]||statusColors.pending;
                const isPending=claim.status==="pending";
                const isRejecting=rejectingId===claim.id;
                return (
                  <div key={claim.id} style={{borderBottom:i<displayed.length-1?`1px solid ${T.border}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",flexWrap:"wrap",opacity:isPending?1:0.85}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:14,fontWeight:500,color:T.text,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{color:T.accent}}>{claim.userName}</span>
                        <span style={{color:T.textHint,fontWeight:400}}>claims to be</span>
                        <a href={`/judge/${claim.judgeSlug}`} target="_blank" rel="noreferrer" style={{color:T.text,textDecoration:"underline",textDecorationColor:T.border}}>{claim.judgeName}</a>
                        <span style={{display:"inline-flex",padding:"1px 9px",borderRadius:100,background:sc.bg,color:sc.color,fontSize:11,fontWeight:600,border:`1px solid ${sc.color}30`}}>{claim.status}</span>
                      </p>
                      <p style={{margin:"3px 0 0",fontSize:12,color:T.textHint}}>{claim.userEmail} · {new Date(claim.submittedAt).toLocaleString()}</p>
                    </div>
                    {isPending&&!isRejecting&&(
                      <div style={{display:"flex",gap:8,flexShrink:0}}>
                        <button onClick={async()=>{try{await onVerifyJudge(claim,true,"");setAllClaims(a=>a.map(c=>c.judgeId===claim.judgeId&&c.status==="pending"?{...c,status:"approved"}:c));setClaimQueue(q=>q.filter(c=>c.judgeId!==claim.judgeId));}catch{}}}
                          style={{padding:"7px 16px",borderRadius:100,border:"none",background:T.green,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                          ✓ Approve
                        </button>
                        <button onClick={()=>{setRejectingId(claim.id);setRejectNote("");}}
                          style={{padding:"7px 16px",borderRadius:100,border:`1px solid ${T.red}`,background:"none",color:T.red,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                  {isRejecting&&(
                    <div style={{padding:"0 20px 16px",display:"flex",flexDirection:"column",gap:10}}>
                      <textarea value={rejectNote} onChange={e=>setRejectNote(e.target.value)} rows={2}
                        placeholder="Internal note (optional) — not shown to claimant"
                        style={{padding:"9px 13px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:13,fontFamily:"inherit",resize:"none",outline:"none",color:T.text,background:T.surface,lineHeight:1.5}}
                        onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>{setRejectingId(null);setRejectNote("");}}
                          style={{padding:"7px 16px",borderRadius:100,border:`1px solid ${T.border}`,background:"none",color:T.textSub,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                          Cancel
                        </button>
                        <button onClick={async()=>{try{await onVerifyJudge(claim,false,rejectNote);setAllClaims(a=>a.map(c=>c.id===claim.id?{...c,status:"rejected",adminNote:rejectNote}:c));setClaimQueue(q=>q.filter(c=>c.id!==claim.id));setRejectingId(null);setRejectNote("");}catch{}}}
                          style={{padding:"7px 16px",borderRadius:100,border:"none",background:T.red,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                          Confirm rejection
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Reviews moderation */}
        {tab==="reviews"&&(
          <div style={{background:T.bg,borderRadius:T.r,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:14,fontWeight:500,color:T.text}}>All reviews</span>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:12,color:T.textHint}}>{reviews.length} total</span>
                {reviews.length>0&&<button onClick={()=>{if(window.confirm(`Remove all ${reviews.length} reviews?`)) onRemoveReview("__all__");}}
                  style={{padding:"4px 12px",borderRadius:100,border:`1px solid ${T.red}`,background:"none",color:T.red,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                  Remove all
                </button>}
              </div>
            </div>
            {reviews.slice().reverse().map((r,i)=>{
              const j=judges.find(jj=>jj.id===r.judgeId);
              return(
                <div key={r.id} style={{padding:"14px 20px",borderBottom:i<reviews.length-1?`1px solid ${T.border}`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <p style={{margin:0,fontSize:14,fontWeight:500,color:T.text}}>{r.userName} → {j?.name||"Unknown"}</p>
                      <p style={{margin:0,fontSize:12,color:T.textHint}}>{r.breed} · {r.show} · {r.date} · ★ {r.overall}</p>
                    </div>
                    <button onClick={()=>onRemoveReview(r.id)}
                      style={{padding:"5px 12px",borderRadius:100,border:`1px solid ${T.red}`,background:"none",color:T.red,fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                      Remove
                    </button>
                  </div>
                  <p style={{margin:0,fontSize:13,color:T.textSub,lineHeight:1.6}}>{r.text.slice(0,200)}{r.text.length>200?"…":""}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin Route ────────────────────────────────────────────────────────────────
export function AdminRoute({judges,reviews,bookings,user,patchJudge,saveJudges,saveReviews}) {
  const navigate=useNavigate();
  if(!user||user.role!=="admin") return <Navigate to="/"/>;
  return (
    <AdminDashboard
      judges={judges} reviews={reviews} bookings={bookings} user={user}
      onBack={()=>navigate("/")}
      onRemoveReview={async(rid)=>{
        if(rid==="__all__") { await saveReviews([]); return; }
        if(!window.confirm("Remove this review?")) return;
        await saveReviews(reviews.filter(r=>r.id!==rid));
      }}
      onVerifyJudge={async(claim,approve,note="")=>{
        try {
          const {db}=await import("../firebase.js");
          const {doc,updateDoc,collection,query,where,getDocs}=await import("firebase/firestore");
          const update={status:approve?"approved":"rejected"};
          if(!approve&&note.trim()) update.adminNote=note.trim();
          await updateDoc(doc(db,"claims",claim.id),update);
          if(approve){
            await updateDoc(doc(db,"judges",claim.judgeId),{verified:true,claimedBy:claim.userEmail});
            patchJudge(claim.judgeId,{verified:true,claimedBy:claim.userEmail});
            await updateDoc(doc(db,"users",claim.userId),{role:"judge",judgeId:claim.judgeId});
            const otherClaims=await getDocs(query(collection(db,"claims"),where("judgeId","==",claim.judgeId)));
            await Promise.all(otherClaims.docs
              .filter(d=>d.id!==claim.id&&d.data().status==="pending")
              .map(d=>updateDoc(d.ref,{status:"rejected"}))
            );
          }
        } catch(e) {
          console.error("onVerifyJudge failed:", e);
          alert("Action failed: " + e.message);
          throw e;
        }
      }}
    />
  );
}
