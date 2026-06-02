import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { T } from "../theme.js";
import { UNIVERSAL_DIMS, GROUP_DIMS, GROUP_NAMES } from "../theme.js";
import { avg, judgeGroups, fmtDate } from "../utils.js";
import { FCI_GROUP_BREEDS } from "../../fci-groups.js";
import { Avatar, FlagImg, OrgPill, Chip, Stars, RatingBar, SectionLabel, InfoRow, Divider, Btn } from "../components/atoms.jsx";
import { ReviewCard } from "../components/ReviewCard.jsx";
import { BreedList } from "../components/BreedList.jsx";
import { GroupSection } from "../components/GroupSection.jsx";
import { ReviewModal } from "../modals/ReviewModal.jsx";
import { BookingModal } from "../modals/BookingModal.jsx";
import { ClaimModal } from "../modals/ClaimModal.jsx";
import { ContactModal } from "../modals/ContactModal.jsx";
import { EditProfileModal } from "../modals/EditProfileModal.jsx";
import { ReplyModal } from "../modals/ReplyModal.jsx";
import { StartConvModal } from "../modals/StartConvModal.jsx";
import { AddOrganiserModal } from "../modals/AddOrganiserModal.jsx";
import { ReviewGateModal } from "../modals/ReviewGateModal.jsx";

// ── QR Section ────────────────────────────────────────────────────────────────
function QRSection({judge}) {
  const thumbRef  = useRef(null);
  const modalRef  = useRef(null);
  const [copied,  setCopied]  = useState(false);
  const [expanded,setExpanded]= useState(false);
  const [mobile,  setMobile]  = useState(window.innerWidth < 640);
  const url = `https://judge.dog/judge/${judge.slug||judge.id}`;

  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    if (!thumbRef.current) return;
    QRCode.toCanvas(thumbRef.current, url, {
      width: mobile ? 52 : 88, margin: 1,
      color: { dark: "#202124", light: "#ffffff" },
    });
  }, [url, mobile]);

  useEffect(() => {
    if (!expanded || !modalRef.current) return;
    QRCode.toCanvas(modalRef.current, url, {
      width: 220, margin: 2,
      color: { dark: "#202124", light: "#ffffff" },
    });
  }, [expanded, url]);

  const download = () => {
    const c = document.createElement("canvas");
    QRCode.toCanvas(c, url, { width: 400, margin: 3, color: { dark: "#202124", light: "#ffffff" } }, () => {
      const a = document.createElement("a");
      a.download = `judge-${judge.slug||judge.id}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
    });
  };

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const iconBtn = (onClick, title, content, active) => (
    <button onClick={onClick} title={title}
      style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:100,
        background:active?T.greenLight:T.surface,color:active?T.green:T.textSub,
        border:`1px solid ${active?T.green:T.border}`,cursor:"pointer",fontSize:12,
        fontWeight:500,fontFamily:"inherit",transition:"all .18s",whiteSpace:"nowrap"}}>
      {content}
    </button>
  );

  return (
    <>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
        <canvas ref={thumbRef}
          onClick={mobile ? () => setExpanded(true) : undefined}
          style={{borderRadius:6,display:"block",cursor:mobile?"pointer":"default",
            boxShadow:"0 1px 4px rgba(0,0,0,.12)"}}/>
        {!mobile && (
          <div style={{display:"flex",gap:4}}>
            {iconBtn(download, "Download QR", "↓ QR")}
            {iconBtn(copy, "Copy profile link", copied ? "✓ Copied" : "⎘ Copy", copied)}
          </div>
        )}
      </div>

      {/* Mobile modal */}
      {expanded && (
        <>
          <div onClick={() => setExpanded(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:200}}/>
          <div style={{position:"fixed",left:"50%",top:"50%",transform:"translate(-50%,-50%)",
            zIndex:201,background:"#fff",borderRadius:20,padding:"28px 32px",
            display:"flex",flexDirection:"column",alignItems:"center",gap:18,
            boxShadow:T.shadowLg}}>
            <canvas ref={modalRef} style={{borderRadius:10,display:"block"}}/>
            <div style={{display:"flex",gap:10}}>
              <button onClick={download}
                style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",
                  borderRadius:100,background:T.surface,color:T.text,border:`1px solid ${T.border}`,
                  cursor:"pointer",fontSize:14,fontWeight:500,fontFamily:"inherit"}}>
                ↓ Download
              </button>
              <button onClick={copy}
                style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",
                  borderRadius:100,background:copied?T.greenLight:T.accent,
                  color:copied?T.green:"#fff",border:"none",
                  cursor:"pointer",fontSize:14,fontWeight:500,fontFamily:"inherit",transition:"all .18s"}}>
                {copied ? "✓ Copied" : "⎘ Copy link"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Judge Page ─────────────────────────────────────────────────────────────────
function JudgePage({judge,reviews,user,onBack,onReview,onBook,onClaim,onEditProfile,onContact,onSaveReply,onRequestAuth}) {
  const [modal,setModal]=useState(null); const [replyTarget,setReplyTarget]=useState(null);
  const rv=reviews.filter(r=>r.judgeId===judge.id).sort((a,b)=>b.date.localeCompare(a.date));
  const wr=rv.filter(r=>r.wouldReturn).length;
  const isOwner=user&&judge.claimedBy===user.email;
  const hasReviewed=user&&rv.some(r=>r.userId===user.id);
  // Show booking button whenever judge can be notified (has email or is claimed)
  const judgeContactable = judge.claimedBy || judge.contact?.email;
  const canBook = !isOwner && judgeContactable;

  const [claimStatus,setClaimStatus]=useState(null);
  useEffect(()=>{
    if(!user||judge.claimedBy) return;
    (async()=>{
      try {
        const {db}=await import("../firebase.js");
        const {doc,getDoc}=await import("firebase/firestore");
        const snap=await getDoc(doc(db,"claims",`${judge.id}__${user.uid}`));
        if(snap.exists()) setClaimStatus(snap.data().status);
      } catch(e){}
    })();
  },[user,judge.id,judge.claimedBy]);

  // JSON-LD structured data for SEO
  useEffect(()=>{
    const profileUrl=`https://judge.dog/judge/${judge.slug||judge.id}`;
    const orgsStr=judge.orgs?.map(o=>o.org).join(", ")||"";
    const desc=judge.bio
      ?judge.bio.slice(0,200)
      :`Dog show judge from ${judge.country||""}${orgsStr?`, licensed by ${orgsStr}`:""}.`;
    const ld={
      "@context":"https://schema.org",
      "@type":"Person",
      "name":judge.name,
      "url":profileUrl,
      "jobTitle":"Dog Show Judge",
      "description":desc,
      ...(judge.country&&{"nationality":judge.country}),
    };
    if(rv.length>0){
      const ratingVal=avg(rv.map(r=>r.overall)).toFixed(1);
      ld.aggregateRating={
        "@type":"AggregateRating",
        "ratingValue":ratingVal,
        "reviewCount":rv.length,
        "bestRating":"5",
        "worstRating":"1",
      };
    }
    const s=document.createElement("script");
    s.type="application/ld+json";
    s.id="judge-ld-json";
    s.text=JSON.stringify(ld);
    document.head.appendChild(s);
    return()=>{ document.getElementById("judge-ld-json")?.remove(); };
  },[judge.id,rv.length]);

  // Use the judge's primary discipline group for the rating breakdown
  const primaryGroup = judgeGroups(judge)[0];
  const breakdownDims = [...UNIVERSAL_DIMS, ...(GROUP_DIMS[primaryGroup]||GROUP_DIMS.A)];
  const dimAvgs = Object.fromEntries(breakdownDims.map(d=>[d.key, avg(rv.map(r=>r[d.key]||0).filter(Boolean))]));
  const universalDims = UNIVERSAL_DIMS;
  const specificDims  = GROUP_DIMS[primaryGroup]||GROUP_DIMS.A;

  return (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:8,position:"sticky",top:0,zIndex:100}}>
        <button onClick={onBack}
          style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14,fontWeight:500,padding:"7px 12px",borderRadius:100,fontFamily:"inherit",transition:"background .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background="none"}>
          ← Back
        </button>
        <span style={{fontSize:13,color:T.textHint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center"}}><FlagImg judge={judge}/>{judge.name}</span>
      </div>

      <div style={{maxWidth:780,margin:"0 auto",padding:"32px 20px"}}>
        {/* Hero */}
        <div style={{display:"flex",gap:20,alignItems:"flex-start",marginBottom:24,flexWrap:"wrap"}}>
          <div style={{position:"relative"}}>
            <Avatar label={judge.photo} photoUrl={judge.profilePhoto} size={76}/>
            {judge.verified&&<div style={{position:"absolute",bottom:0,right:0,width:22,height:22,background:T.green,borderRadius:"50%",border:`3px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff"}}>✓</div>}
          </div>
          <div style={{flex:1,minWidth:180}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
              <h1 style={{margin:0,fontSize:24,fontWeight:400,color:T.text,letterSpacing:-0.4,display:"flex",alignItems:"center",gap:8}}><FlagImg judge={judge} height={18}/>{judge.name}</h1>
              {judge.verified&&<Chip bg={T.greenLight} color={T.green} small>✓ Verified</Chip>}
            </div>
            {judge.headline&&<p style={{margin:"0 0 6px",fontSize:14,color:T.textSub,fontStyle:"italic"}}>{judge.headline}</p>}
            {/* Key facts row */}
            <div style={{display:"flex",flexWrap:"wrap",gap:16,marginBottom:12}}>
              <span style={{fontSize:13,color:T.textSub}}>{judge.country}</span>
              {judge.birthYear&&<span style={{fontSize:13,color:T.textSub}}>Born {judge.birthYear}</span>}
              {judge.licensedYear&&<span style={{fontSize:13,color:T.textSub}}>Lic. {judge.licensedYear}</span>}
            </div>
            {/* Org IDs — each org shows its own ID with appropriate label */}
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
              {judge.orgs.map(o=>{
                // Format ID per org: numeric IDs get "#" prefix, alphanumeric stay as-is
                const idLabel = o.id ? (/^\d+$/.test(o.id) ? `#${o.id}` : o.id) : null;
                return (
                  <div key={o.org} style={{display:"flex",alignItems:"center",gap:4}}>
                    <OrgPill org={o.org}/>
                    {idLabel&&<code style={{fontSize:11,color:T.textHint,background:T.surface,padding:"1px 5px",borderRadius:4}}>{idLabel}</code>}
                  </div>
                );
              })}
            </div>
            {/* BIS */}
            {judge.bisJudge&&(
              <div style={{marginBottom:8}}>
                <Chip bg="#fff8e1" color="#f57f17" small>★ BIS Judge</Chip>
              </div>
            )}
          </div>
          {rv.length>0&&(
            <div style={{textAlign:"center",background:T.surface,borderRadius:T.r,padding:"14px 22px",flexShrink:0,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:38,fontWeight:300,color:T.text,lineHeight:1,marginBottom:4}}>{dimAvgs.overall.toFixed(1)}</div>
              <Stars val={dimAvgs.overall} size={15}/>
              <div style={{fontSize:12,color:T.textHint,marginTop:5}}>{rv.length} review{rv.length!==1?"s":""}</div>
            </div>
          )}
          <QRSection judge={judge}/>
        </div>

        {/* Is this you? banner — shown to everyone on unclaimed profiles */}
        {!judge.claimedBy&&(
          <div style={{background:claimStatus==="pending"?"#fffbe6":T.accentLight,border:`1px solid ${claimStatus==="pending"?"#ffe58f":"#c5d9f7"}`,borderRadius:T.r,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            {claimStatus==="pending"?(
              <>
                <div>
                  <p style={{margin:0,fontSize:14,fontWeight:500,color:T.text}}>Claim pending review</p>
                  <p style={{margin:"2px 0 0",fontSize:13,color:T.textSub}}>We'll review your request and get back to you. You'll receive judge access once approved.</p>
                </div>
                <Chip bg="#fffbe6" color={T.amber}>⏳ Pending</Chip>
              </>
            ):(
              <>
                <div>
                  <p style={{margin:0,fontSize:14,fontWeight:500,color:T.text}}>Is this you?</p>
                  <p style={{margin:"2px 0 0",fontSize:13,color:T.textSub}}>Claim this profile to manage it, reply to reviews and receive messages.</p>
                </div>
                {user
                  ? <Btn onClick={onClaim} small>Claim profile</Btn>
                  : <Btn onClick={onRequestAuth} small>Sign in to claim</Btn>
                }
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
          {!isOwner&&!claimStatus&&!hasReviewed&&<Btn onClick={onReview}>{user?"Write a review":"Sign in to review"}</Btn>}
          {!isOwner&&!claimStatus&&hasReviewed&&<Chip bg={T.greenLight} color={T.green}>✓ Reviewed</Chip>}
          {canBook&&<Btn onClick={onBook} color={T.green} icon="📅">Request booking</Btn>}
          {isOwner&&<Btn onClick={onEditProfile} variant="outlined" icon="✏">Edit profile</Btn>}
        </div>

        {/* Official Details */}
        {(judge.kennelClub||judge.fciLanguages?.length>0||judge.otherLanguages?.length>0||judge.kennelName||judge.akcFeeInfo||judge.akcJudgeUrl)&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
            <SectionLabel>Official details</SectionLabel>
            <div style={{marginTop:-4}}>
              <InfoRow label="Country of legal residence" value={judge.countryOfResidence||judge.country}/>
              <InfoRow label="National kennel club" value={judge.kennelClub}/>
              <InfoRow label="FCI languages" value={judge.fciLanguages?.length>0?judge.fciLanguages.join(", "):null}/>
              <InfoRow label="Other languages" value={judge.otherLanguages?.length>0?judge.otherLanguages.join(", "):null}/>
              <InfoRow label="FCI kennel name" value={judge.kennelName}/>
              <InfoRow label="Judge fee info" value={judge.akcFeeInfo}/>
              {judge.akcJudgeUrl&&<InfoRow label="Judge website" value={<a href={judge.akcJudgeUrl} target="_blank" rel="noopener noreferrer" style={{color:T.accent}}>{judge.akcJudgeUrl}</a>}/>}
              {judge.akcVisitingJudge&&<InfoRow label="Visiting judge" value="Available for international assignments"/>}
            </div>
          </div>
        )}

        {/* Suspensions */}
        {judge.suspensions?.length>0&&(
          <div style={{background:T.redLight,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`2px solid ${T.red}30`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <span style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:1}}>
                ⚠ Suspensions
              </span>
              <span style={{fontSize:11,fontWeight:600,color:"#fff",background:T.red,padding:"1px 8px",borderRadius:100}}>{judge.suspensions.length}</span>
            </div>
            {judge.suspensions.map((cells,i)=>(
              <div key={i} style={{display:"flex",flexWrap:"wrap",gap:8,padding:"10px 0",borderTop:i>0?`1px solid ${T.red}25`:undefined}}>
                {cells.filter(Boolean).map((cell,j)=>(
                  <span key={j} style={{fontSize:13,color:T.text,background:"rgba(217,48,37,.07)",padding:"4px 12px",borderRadius:6}}>{cell}</span>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Bio */}
        {judge.bio&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
            <SectionLabel>About</SectionLabel>
            <p style={{color:T.text,fontSize:14,lineHeight:1.8,margin:0}}>{judge.bio}</p>
          </div>
        )}

        {/* Social */}
        {judge.social&&(judge.social.instagram||judge.social.facebook||judge.social.linkedin||judge.social.website)&&(
          <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
            {judge.social.instagram&&<a href={`https://instagram.com/${judge.social.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:100,background:T.surface,color:T.text,textDecoration:"none",fontSize:13,border:`1px solid ${T.border}`,fontWeight:500}}>📷 {judge.social.instagram}</a>}
            {judge.social.facebook&&<a href={`https://facebook.com/${judge.social.facebook}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:100,background:T.surface,color:T.text,textDecoration:"none",fontSize:13,border:`1px solid ${T.border}`,fontWeight:500}}>f {judge.social.facebook}</a>}
            {judge.social.linkedin&&<a href={`https://linkedin.com/in/${judge.social.linkedin}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:100,background:T.surface,color:T.text,textDecoration:"none",fontSize:13,border:`1px solid ${T.border}`,fontWeight:500}}>in {judge.social.linkedin}</a>}
            {judge.social.website&&<a href={judge.social.website.startsWith("http")?judge.social.website:"https://"+judge.social.website} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:100,background:T.surface,color:T.text,textDecoration:"none",fontSize:13,border:`1px solid ${T.border}`,fontWeight:500}}>🌐 Website</a>}
          </div>
        )}

        {/* Career highlights */}
        {judge.highlights?.length>0&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
            <SectionLabel>Career highlights</SectionLabel>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
              {judge.highlights.map((h,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <span style={{color:T.accent,fontSize:13,marginTop:2,flexShrink:0}}>★</span>
                  <span style={{fontSize:14,color:T.text,lineHeight:1.6}}>{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {judge.galleryPhotos?.length>0&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
            <SectionLabel>Gallery</SectionLabel>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginTop:4}}>
              {judge.galleryPhotos.map((url,i)=>(
                <div key={i} style={{aspectRatio:"1",borderRadius:T.rsm,overflow:"hidden",cursor:"pointer"}}
                  onClick={()=>window.open(url,"_blank")}>
                  <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",transition:"transform .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disciplines */}
        {judge.disciplines?.length>0&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
            <SectionLabel>Disciplines</SectionLabel>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {judge.disciplines.map(d=><Chip key={d}>{d}</Chip>)}
            </div>
          </div>
        )}

        {/* Breed authorizations */}
        {(()=>{
          const provSet = new Set(judge.akcProvisionalBreeds||[]);
          const groupCovered=new Set((judge.groupNames||[]).flatMap(g=>(FCI_GROUP_BREEDS[g.group]||[]).map(b=>b.toLowerCase())));
          const extra=(judge.breeds||[]).filter(b=>!groupCovered.has(b.toLowerCase()));
          const hasProvBreeds = provSet.size > 0;
          return (
            <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
              <SectionLabel>Breed authorizations</SectionLabel>
              {hasProvBreeds&&<p style={{margin:"0 0 10px",fontSize:12,color:"#b45309"}}><span style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:10,letterSpacing:.3}}>PROV</span> = Provisional approval</p>}
              {judge.allBreedJudge ? (
                <Chip bg={T.greenLight} color={T.green}>All breeds</Chip>
              ) : judge.groupNames?.length>0 ? (
                <>
                  {judge.groupNames.map(g=><GroupSection key={g.group} groupNum={g.group} groupName={g.name}/>)}
                  {extra.length>0&&<BreedList breeds={extra} label="Additional individual breeds" provisionalSet={provSet}/>}
                </>
              ) : judge.breeds?.length>0 ? (
                <BreedList breeds={judge.breeds} provisionalSet={provSet}/>
              ) : (
                <p style={{margin:0,fontSize:13,color:T.textHint,fontStyle:"italic"}}>No breed authorization data on file</p>
              )}
            </div>
          );
        })()}

        {/* Rating breakdown */}
        {rv.length>0&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:24,border:`1px solid ${T.border}`}}>
            <SectionLabel>Rating breakdown · {GROUP_NAMES[primaryGroup]}</SectionLabel>

            <p style={{fontSize:12,color:T.textSub,margin:"0 0 10px",fontWeight:500}}>Universal</p>
            {universalDims.map(d=><RatingBar key={d.key} label={d.label} value={dimAvgs[d.key]} highlight={d.key==="overall"}/>)}

            <Divider my={14}/>
            <p style={{fontSize:12,color:T.textSub,margin:"0 0 10px",fontWeight:500}}>{GROUP_NAMES[primaryGroup]}</p>
            {specificDims.map(d=><RatingBar key={d.key} label={d.label} value={dimAvgs[d.key]}/>)}

            <Divider my={14}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:T.textSub}}>Would show under again</span>
              <span style={{fontSize:13,fontWeight:600,color:wr/rv.length>=.6?T.green:T.red}}>
                {Math.round(wr/rv.length*100)}% <span style={{fontWeight:400,color:T.textHint}}>({wr}/{rv.length})</span>
              </span>
            </div>
          </div>
        )}

        {/* Reviews */}
        <h2 style={{margin:"0 0 4px",fontSize:17,fontWeight:400,color:T.text}}>
          Reviews {rv.length>0&&<span style={{color:T.textHint,fontWeight:300,fontSize:15}}>({rv.length})</span>}
        </h2>
        {rv.length===0?(
          <div style={{textAlign:"center",padding:"52px 0",color:T.textHint}}>
            <div style={{fontSize:36,marginBottom:10}}>📋</div>
            <p style={{fontSize:15,fontWeight:300,color:T.textSub,margin:"0 0 4px"}}>No reviews yet</p>
            <p style={{fontSize:13,margin:0}}>Be the first to review {judge.name.split(" ")[0]}</p>
          </div>
        ):(
          rv.map(r=><ReviewCard key={r.id} review={r} isJudge={isOwner} onReply={rev=>{setReplyTarget(rev);setModal("reply");}}/>)
        )}
      </div>
      {modal==="reply"&&replyTarget&&<ReplyModal review={replyTarget} onClose={()=>{setModal(null);setReplyTarget(null);}} onReply={onSaveReply}/>}
    </div>
  );
}

// ── Judge Route ────────────────────────────────────────────────────────────────
export function JudgeRoute({judges,reviews,user,addReview,claimJudge,editProfile,saveReply,onRequestAuth,onUserUpdated}) {
  const {slug}=useParams();
  const navigate=useNavigate();
  const [modal,setModal]=useState(null);
  // Track user locally so AddOrganiserModal update is immediate
  const [localUser, setLocalUser]=useState(user);
  // Keep in sync when parent user changes (login/logout)
  if(user!==localUser&&JSON.stringify(user)!==JSON.stringify(localUser)) setLocalUser(user);
  // Check canonical slug, doc id, and any historical slug aliases
  const judge=judges.find(j=>j.slug===slug||j.id===slug||j.slugAliases?.includes(slug));

  // Redirect alias URLs to the canonical slug (preserves QR codes / old links)
  useEffect(()=>{
    if(!judge) return;
    const canonical=judge.slug||judge.id;
    if(slug!==canonical&&slug!==judge.id){
      navigate(`/judge/${canonical}`,{replace:true});
    }
  },[judge?.id,slug]);

  useEffect(()=>{
    if(!judge) return;
    document.title=`${judge.name} — Dog Show Judge Reviews | judge.dog`;
    return()=>{ document.title="judge.dog — Know your judge before you enter"; };
  },[judge?.name]);

  const handleBook=()=>{
    if(!localUser){onRequestAuth();return;}
    const hasOrganiserRole=localUser.organizerStatus||localUser.role==="judge";
    if(hasOrganiserRole) setModal("booking");
    else setModal("addOrganiser");
  };

  const handleContact=()=>{
    if(judge.claimedBy){
      if(!user){onRequestAuth();return;}
      setModal("startConv");
    } else {
      setModal("contact");
    }
  };

  if(!judge) return (
    <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:T.textHint}}>
      <div style={{fontSize:36}}>🔍</div>
      <p style={{fontSize:15,color:T.textSub,margin:0}}>Judge not found.</p>
    </div>
  );

  return (
    <>
      <JudgePage judge={judge} reviews={reviews} user={localUser}
        onBack={()=>navigate(-1)}
        onReview={()=>{
          if(!localUser){onRequestAuth();return;}
          // Gate organisers before the review form
          if(localUser.organizerStatus) setModal("reviewGate");
          else setModal("review");
        }}
        onBook={handleBook}
        onClaim={()=>setModal("claim")}
        onContact={handleContact}
        onEditProfile={()=>setModal("editProfile")}
        onSaveReply={saveReply}
        onRequestAuth={onRequestAuth}/>
      {modal==="reviewGate"&&localUser&&<ReviewGateModal
        judgeName={judge.name}
        isOwnerHandler={localUser.isOwnerHandler !== false}
        onClose={()=>setModal(null)}
        onConfirm={()=>setModal("review")}
        onAddOwnerHandler={async()=>{
          try{
            const {db}=await import("../firebase.js");
            const {doc,updateDoc}=await import("firebase/firestore");
            await updateDoc(doc(db,"users",localUser.uid),{isOwnerHandler:true});
            const updated={...localUser,isOwnerHandler:true};
            setLocalUser(updated); onUserUpdated?.(updated);
            setModal("review");
          }catch(e){console.error(e);}
        }}/>}
      {modal==="review"&&localUser&&<ReviewModal judge={judge} user={localUser} onClose={()=>setModal(null)} onSubmit={addReview}/>}
      {modal==="booking"&&localUser&&<BookingModal judge={judge} user={localUser} onClose={()=>setModal(null)}/>}
      {modal==="addOrganiser"&&localUser&&<AddOrganiserModal user={localUser} onClose={()=>setModal(null)}
        onComplete={updated=>{
          setLocalUser(updated);
          onUserUpdated?.(updated);
          setModal("booking");
        }}/>}
      {modal==="claim"&&localUser&&<ClaimModal judge={judge} user={localUser} onClose={()=>setModal(null)}/>}
      {modal==="contact"&&<ContactModal judge={judge} user={localUser} onClose={()=>setModal(null)}/>}
      {modal==="startConv"&&localUser&&<StartConvModal judge={judge} user={localUser} onClose={()=>setModal(null)} onCreated={()=>navigate("/messages")}/>}
      {modal==="editProfile"&&<EditProfileModal judge={judge} onClose={()=>setModal(null)} onSave={editProfile}/>}
    </>
  );
}
