import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { firebaseSignOut, onAuthChange, initAnalytics } from "./firebase";
import { PrivacyPolicy, TermsOfService, CookiePolicy, ReviewGuidelines } from "./LegalPages";
import { FCI_GROUP_BREEDS } from "../fci-groups.js";

import { T } from "./theme.js";
import { avg, toSlug, initials, sGet, sSet, K } from "./utils.js";
import { matchesDiscipline } from "./disciplines.js";
import { SEED_JUDGES } from "./seeds.js";

import { Avatar, Btn, ScrollToTop } from "./components/atoms.jsx";
import { CookieBanner } from "./components/CookieBanner.jsx";
import { Footer } from "./components/Footer.jsx";

import { AuthModal } from "./modals/AuthModal.jsx";
import { ConsentModal } from "./modals/ConsentModal.jsx";

import { JudgeRoute } from "./pages/JudgePage.jsx";
import { AdminRoute } from "./pages/AdminPage.jsx";
import { MessagesRoute } from "./pages/MessagesPage.jsx";
import { JudgeDashboard } from "./pages/JudgeDashboard.jsx";
import { ContactPage } from "./pages/ContactPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { BookingsPage } from "./pages/BookingsPage.jsx";
import { Landing } from "./pages/Landing.jsx";

export default function App() {
  const [judges,setJudges]=useState([]); const [reviews,setReviews]=useState([]);
  const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true); const [modal,setModal]=useState(null);
  const [unreadMsgCount,setUnreadMsgCount]=useState(0);
  const [unreadBookingCount,setUnreadBookingCount]=useState(0);
  const [search,setSearch]=useState(""); const [sort,setSort]=useState("name"); const [orgFilter,setOrgFilter]=useState("all"); const [disciplineFilter,setDisciplineFilter]=useState("all");
  const [displayCount,setDisplayCount]=useState(48);
  const navSearchRef=useRef(null);
  const heroSearchRef=useRef(null);
  // Keep focus alive across the landing ↔ results transition.
  // landing→results: focus nav input so typing continues uninterrupted.
  // results→landing: focus hero input so the user doesn't have to click.
  const prevSearchEmpty=useRef(true);
  useEffect(()=>{
    const empty=!search.trim();
    if(!empty && prevSearchEmpty.current){
      // just left landing — focus nav bar
      navSearchRef.current?.focus();
    } else if(empty && !prevSearchEmpty.current){
      // just returned to landing — hero mounts on next paint, wait one frame
      requestAnimationFrame(()=>heroSearchRef.current?.focus());
    }
    prevSearchEmpty.current=empty;
  },[search]);
  const [isMobile,setIsMobile]=useState(window.innerWidth<640);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [cookieConsent,setCookieConsent]=useState(()=>localStorage.getItem("jyj_cookie_consent"));
  const navigate=useNavigate();
  const location=useLocation();

  useEffect(()=>{
    const BATCH=200;
    (async()=>{
      const sr=await sGet(K.reviews,null);
      if(!sr){await sSet(K.reviews,[]);setReviews([]);}else setReviews(sr);

      try {
        const {db}=await import("./firebase");
        const {collection,query,orderBy,limit,startAfter,getDocs}=await import("firebase/firestore");

        // First batch — unblock the UI immediately
        const q0=query(collection(db,"judges"),orderBy("name"),limit(BATCH));
        const snap0=await getDocs(q0);
        setJudges(snap0.docs.map(d=>({...d.data(),id:d.id})));
        setLoading(false);

        // Remaining batches in the background
        let last=snap0.docs[snap0.docs.length-1];
        while(last&&snap0.docs.length===BATCH){
          const qN=query(collection(db,"judges"),orderBy("name"),startAfter(last),limit(BATCH));
          const snapN=await getDocs(qN);
          if(!snapN.docs.length) break;
          setJudges(jj=>[...jj,...snapN.docs.map(d=>({...d.data(),id:d.id}))]);
          if(snapN.docs.length<BATCH) break;
          last=snapN.docs[snapN.docs.length-1];
        }
      } catch(e){
        console.error("Failed to load judges:",e);
        setJudges(await sGet(K.judges,SEED_JUDGES));
        setLoading(false);
      }
    })();
    const unsub=onAuthChange(u=>setUser(u));
    return()=>unsub();
  },[]);

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<640);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);

  // Init analytics if already consented
  useEffect(()=>{ if(cookieConsent==="accepted") initAnalytics(); },[cookieConsent]);

  // If onAuthChange detects a Firebase session with no profile doc, show consent modal
  useEffect(()=>{ if(user?.needsConsent) setModal("consent"); },[user?.needsConsent]);

  useEffect(()=>{ setMobileMenuOpen(false); },[location.pathname]);
  useEffect(()=>{ setDisplayCount(48); setDisciplineFilter("all"); },[orgFilter]);
  useEffect(()=>{ setDisplayCount(48); },[search,disciplineFilter,sort]);

  useEffect(()=>{
    if(!user){setUnreadMsgCount(0);return;}
    const isJudge=user.role==="judge"&&user.judgeId;
    let unsub;
    (async()=>{
      try {
        const {db}=await import("./firebase");
        const {collection,query,where,onSnapshot}=await import("firebase/firestore");
        const q=isJudge
          ? query(collection(db,"conversations"),where("judgeId","==",user.judgeId))
          : query(collection(db,"conversations"),where("senderUid","==",user.uid));
        unsub=onSnapshot(q,snap=>{
          const total=snap.docs.reduce((s,d)=>{
            const data=d.data();
            return s+(isJudge?(data.unreadForJudge||0):(data.unreadForSender||0));
          },0);
          setUnreadMsgCount(total);
        },()=>{});
      } catch(e){}
    })();
    return()=>{if(unsub)unsub();};
  },[user]);

  // Booking badge listener
  useEffect(()=>{
    if(!user){setUnreadBookingCount(0);return;}
    const isJudge=user.role==="judge"&&user.judgeId;
    const isOrg=!!user.organizerStatus;
    if(!isJudge&&!isOrg){setUnreadBookingCount(0);return;}
    let unsub;
    (async()=>{
      try{
        const {db}=await import("./firebase");
        const {collection,query,where,onSnapshot}=await import("firebase/firestore");
        // Judge: count pending inquiries; Organiser: count unread status changes
        const q=isJudge
          ? query(collection(db,"bookingInquiries"),where("judgeId","==",user.judgeId),where("status","==","pending"))
          : query(collection(db,"bookingInquiries"),where("organiserId","==",user.uid),where("organiserRead","==",false));
        unsub=onSnapshot(q,snap=>setUnreadBookingCount(snap.size),()=>{});
      }catch(e){}
    })();
    return()=>{if(unsub)unsub();};
  },[user]);

  const saveJudges=async jj=>{
    setJudges(jj);
    try {
      const {db} = await import("./firebase");
      const {doc,setDoc} = await import("firebase/firestore");
      for(const j of jj) await setDoc(doc(db,"judges",j.id),j);
    } catch(e){ console.error("Failed to save judges:", e); }
  };
  const saveReviews=async rr=>{setReviews(rr);await sSet(K.reviews,rr);};
  const acceptCookies=()=>{ localStorage.setItem("jyj_cookie_consent","accepted"); setCookieConsent("accepted"); initAnalytics(); };
  const declineCookies=()=>{ localStorage.setItem("jyj_cookie_consent","declined"); setCookieConsent("declined"); };
  const manageCookies=()=>{ localStorage.removeItem("jyj_cookie_consent"); setCookieConsent(null); };
  const addReview=useCallback(async r=>{const u=[...reviews,r];await saveReviews(u);},[reviews]);

  const claimJudge=useCallback(async(judgeId)=>{
    if(!judgeId||!user) return;
    await saveJudges(judges.map(j=>j.id===judgeId?{...j,verified:true,claimedBy:user.email}:j));
    const {db}=await import("./firebase");
    const {doc,updateDoc}=await import("firebase/firestore");
    await updateDoc(doc(db,"users",user.uid),{role:"judge",judgeId});
    setUser(u=>({...u,role:"judge",judgeId}));
  },[judges,user]);

  const editProfile=useCallback(async upd=>{
    // If name changed, regenerate slug and archive the old one
    const prev=judges.find(j=>j.id===upd.id);
    if(prev&&upd.name&&upd.name!==prev.name){
      const newSlug=toSlug(upd.name);
      const oldSlug=prev.slug||prev.id;
      const existing=prev.slugAliases||[];
      upd={...upd,slug:newSlug,
        slugAliases:oldSlug&&oldSlug!==newSlug&&!existing.includes(oldSlug)
          ?[...existing,oldSlug]:existing};
    }
    setJudges(jj=>jj.map(j=>j.id===upd.id?upd:j));
    const {db}=await import("./firebase");
    const {doc,setDoc}=await import("firebase/firestore");
    await setDoc(doc(db,"judges",upd.id),upd);
  },[judges]);

  const saveReply=useCallback(async(rid,text)=>{
    await saveReviews(reviews.map(r=>r.id===rid?{...r,reply:text}:r));
  },[reviews]);

  const logout=async()=>{await firebaseSignOut();setUser(null);};

  // Filter out judges with clearly corrupted names
  const hasValidName = j => {
    const n = (j.name||"").trim();
    if (n.length < 3) return false;
    // Strip parenthesized content — FCI licence IDs like (by43), (jp166) pollute the name
    const nameOnly = n.replace(/\([^)]*\)/g, "").trim();
    if (!nameOnly) return false;
    // Must have at least 3 real letters outside parentheses
    if ((nameOnly.match(/[a-zA-ZÀ-žА-яёЁ]/g)||[]).length < 3) return false;
    // Must contain at least one word with 2+ consecutive letters (filters "A A.", ". ..")
    if (!/[a-zA-ZÀ-žА-яёЁ]{2,}/.test(nameOnly)) return false;
    return true;
  };

  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim();
    const visible=judges.filter(j=>!j.hidden && hasValidName(j));
    // When no text query but filters active, apply org/discipline filters only
    if(!q){
      return visible.filter(j=>{
        const mO=orgFilter==="all"||j.orgs.some(o=>o.org===orgFilter);
        const mD=matchesDiscipline(j,disciplineFilter);
        return mO&&mD;
      }).sort((a,b)=>a.name.localeCompare(b.name));
    }
    // Check once if the query matches any known breed globally (for all-breed judges)
    const isKnownBreedQuery=Object.values(FCI_GROUP_BREEDS).some(arr=>arr.some(b=>b.toLowerCase().includes(q)));
    return visible.filter(j=>{
      const nameMatch=j.name.toLowerCase().includes(q);
      const countryMatch=(j.country||"").toLowerCase().includes(q);
      const breedMatch=!nameMatch&&!countryMatch&&(
        (j.breeds||[]).some(b=>b.toLowerCase().includes(q))||(j.allBreedJudge&&isKnownBreedQuery)
      );
      const mQ=nameMatch||countryMatch||breedMatch||(j.group||"").toLowerCase().includes(q);
      const mO=orgFilter==="all"||j.orgs.some(o=>o.org===orgFilter);
      const mD=matchesDiscipline(j,disciplineFilter);
      return mQ&&mO&&mD;
    }).sort((a,b)=>{
      if(sort==="name") return a.name.localeCompare(b.name);
      const ra=reviews.filter(r=>r.judgeId===a.id),rb=reviews.filter(r=>r.judgeId===b.id);
      if(sort==="rating") return avg(rb.map(r=>r.overall||0))-avg(ra.map(r=>r.overall||0));
      if(sort==="reviews") return rb.length-ra.length;
      return 0;
    });
  },[judges,reviews,search,orgFilter,disciplineFilter,sort]);

  if(loading) return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:T.textHint,fontFamily:"'Google Sans Text','Segoe UI',system-ui,sans-serif"}}>Loading…</div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;600&family=Google+Sans+Text:wght@300;400;500&display=swap');
        *{box-sizing:border-box;} body{margin:0;background:${T.bg};font-family:'Google Sans Text','Segoe UI',system-ui,sans-serif;color:${T.text};-webkit-font-smoothing:antialiased;}
        input,textarea,button,select{font-family:inherit;}
        ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:${T.surface};} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235f6368'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px!important;}
      `}</style>

      <ScrollToTop/>
      <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>

      {/* Nav */}
      <nav style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:isMobile?"0 12px":"0 20px",display:"flex",alignItems:"center",gap:isMobile?8:0,justifyContent:"space-between",height:64,flexShrink:0,zIndex:200}}>
        {/* Brand */}
        <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0}} onClick={()=>{setSearch("");navigate("/")}}>

          <svg width="51" height="51" viewBox="-55 -55 110 110" xmlns="http://www.w3.org/2000/svg">
            <circle cx="0"     cy="-28"  r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="19.8"  cy="-19.8" r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="28"    cy="0"    r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="19.8"  cy="19.8" r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="0"     cy="28"   r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="-19.8" cy="19.8" r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="-28"   cy="0"    r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="-19.8" cy="-19.8" r="10" fill="#1a73e8" opacity="0.25"/>
            <circle cx="0" cy="0" r="22" fill="#1a73e8"/>
            <path d="M0,-12 L2.8,-4.2 L11,-3.5 L4.8,2.4 L6.8,11 L0,6.8 L-6.8,11 L-4.8,2.4 L-11,-3.5 L-2.8,-4.2 Z" fill="white"/>
          </svg>
          {!isMobile&&<span style={{fontSize:26,fontWeight:700,color:T.text,letterSpacing:-0.5,fontFamily:"'Google Sans',sans-serif",lineHeight:1}}>
            judge<span style={{color:T.accent,fontWeight:400}}>.dog</span>
          </span>}
        </div>

        {/* Mobile: inline search bar — always visible, fills available space */}
        {isMobile&&(
          <div style={{flex:1,position:"relative",minWidth:0}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:T.textHint,pointerEvents:"none",lineHeight:1}}>🔍</span>
            <input value={search} onChange={e=>{setSearch(e.target.value);navigate("/");}}
              placeholder="Search…"
              style={{width:"100%",padding:"8px 10px 8px 30px",border:`1.5px solid ${T.border}`,borderRadius:100,fontSize:13,background:T.surface,outline:"none",color:T.text,boxSizing:"border-box"}}
              onFocus={e=>{e.target.style.borderColor=T.accent;e.target.placeholder="Search judges, breeds, countries…";}}
              onBlur={e=>{e.target.style.borderColor=T.border;e.target.placeholder="Search…";}}/>
          </div>
        )}

        {/* Desktop: centered search — hidden on landing (hero has its own) */}
        {!isMobile&&!(location.pathname==="/"&&!search.trim()&&orgFilter==="all"&&disciplineFilter==="all"&&!(user?.role==="judge"&&user?.judgeId))&&(
          <div style={{position:"absolute",left:0,right:0,display:"flex",justifyContent:"center",pointerEvents:"none"}}>
            <div style={{width:480,maxWidth:"calc(100vw - 340px)",position:"relative",pointerEvents:"all"}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.textHint,pointerEvents:"none",lineHeight:1}}>🔍</span>
              <input ref={navSearchRef} value={search} onChange={e=>{setSearch(e.target.value);navigate("/");}}
                placeholder="Search judges, breeds, countries…"
                style={{width:"100%",padding:"8px 14px 8px 36px",border:`1.5px solid ${T.border}`,borderRadius:100,fontSize:13,background:T.surface,outline:"none",color:T.text,boxSizing:"border-box",transition:"border-color .15s,box-shadow .15s"}}
                onFocus={e=>{e.target.style.borderColor=T.accent;e.target.style.boxShadow=`0 0 0 3px ${T.accentLight}`;}}
                onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow="none";}}/>
            </div>
          </div>
        )}

        {/* Desktop: user controls */}
        {!isMobile&&(
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,minWidth:140,justifyContent:"flex-end"}}>
            <button onClick={()=>navigate("/contact")}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:T.textSub,fontWeight:500,padding:"6px 10px",borderRadius:100,fontFamily:"inherit",transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.surface}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              Contact
            </button>
            {user?(
              <>
                <button onClick={()=>navigate("/messages")} title="Messages"
                  style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:"6px 10px",borderRadius:100,color:T.textSub,fontSize:22,display:"flex",alignItems:"center",lineHeight:1}}>
                  ✉
                  {unreadMsgCount>0&&<span style={{position:"absolute",top:2,right:4,width:16,height:16,background:T.red,borderRadius:"50%",fontSize:10,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{unreadMsgCount}</span>}
                </button>
                {(user.role==="judge"||user.organizerStatus)&&(
                  <button onClick={()=>navigate("/my-bookings")} title="Bookings"
                    style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:"6px 10px",borderRadius:100,color:T.textSub,fontSize:20,display:"flex",alignItems:"center",lineHeight:1}}>
                    📋
                    {unreadBookingCount>0&&<span style={{position:"absolute",top:2,right:4,width:16,height:16,background:T.red,borderRadius:"50%",fontSize:10,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{unreadBookingCount}</span>}
                  </button>
                )}
                <div onClick={()=>navigate("/settings")}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px 5px 6px",borderRadius:100,background:T.surface,border:`1px solid ${T.border}`,cursor:"pointer",transition:"background .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHover}
                  onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
                  {(user.profilePhoto||user.photo)
                    ?<img src={user.profilePhoto||user.photo} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover"}} alt=""/>
                    :<Avatar label={initials(user.name)} size={26}/>}
                  <span style={{fontSize:13,color:T.textSub,fontWeight:500}}>{user.name.split(" ")[0]}</span>
                </div>
                <Btn onClick={logout} variant="outlined" small>Sign out</Btn>
                {user.role==="admin"&&<Btn onClick={()=>navigate("/admin")} variant="tonal" small>⚙ Admin</Btn>}
              </>
            ):(
              <Btn onClick={()=>setModal("auth")}>Sign in</Btn>
            )}
          </div>
        )}

        {/* Mobile: hamburger */}
        {isMobile&&(
          <button onClick={()=>setMobileMenuOpen(o=>!o)}
            style={{background:"none",border:"none",cursor:"pointer",padding:"8px",color:T.text,fontSize:22,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8,flexShrink:0}}>
            {mobileMenuOpen?"✕":"☰"}
          </button>
        )}
      </nav>

      {/* Mobile dropdown — user controls only (search is in the nav) */}
      {isMobile&&mobileMenuOpen&&(
        <>
          <div onClick={()=>setMobileMenuOpen(false)}
            style={{position:"fixed",inset:0,top:64,background:"rgba(0,0,0,.25)",zIndex:198}}/>
          <div style={{position:"fixed",top:64,left:0,right:0,background:T.bg,zIndex:199,padding:"16px 20px 20px",borderBottom:`1px solid ${T.border}`,boxShadow:T.shadowMd}}>
            {user?(
              <>
                <div onClick={()=>{navigate("/settings");setMobileMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,paddingBottom:12,borderBottom:`1px solid ${T.border}`,marginBottom:12,cursor:"pointer"}}>
                  {(user.profilePhoto||user.photo)
                    ?<img src={user.profilePhoto||user.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
                    :<Avatar label={initials(user.name)} size={38}/>}
                  <div style={{minWidth:0,flex:1}}>
                    <p style={{margin:0,fontSize:15,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</p>
                    <p style={{margin:0,fontSize:12,color:T.textHint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</p>
                  </div>
                  <span style={{fontSize:12,color:T.textHint,flexShrink:0}}>Settings →</span>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <Btn onClick={()=>{logout();setMobileMenuOpen(false);}} variant="outlined" small>Sign out</Btn>
                  {user.role==="admin"&&<Btn onClick={()=>{navigate("/admin");setMobileMenuOpen(false);}} variant="tonal" small>⚙ Admin</Btn>}
                  <Btn onClick={()=>{navigate("/messages");setMobileMenuOpen(false);}} variant="outlined" small>✉ Messages{unreadMsgCount>0?` (${unreadMsgCount})`:""}</Btn>
                </div>
              </>
            ):(
              <Btn onClick={()=>{setModal("auth");setMobileMenuOpen(false);}} fullWidth>Sign in</Btn>
            )}
            <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
              <Btn onClick={()=>{navigate("/contact");setMobileMenuOpen(false);}} variant="outlined" small fullWidth>Contact us</Btn>
            </div>
          </div>
        </>
      )}

      <div id="routes-wrapper" style={{flex:1,overflowY:"auto",overflowX:"hidden"}}><Routes>
        <Route path="/" element={user?.role==="judge" && user?.judgeId && !search.trim()
          ? <JudgeDashboard
              user={user}
              judge={judges.find(j=>j.id===user.judgeId)}
              reviews={reviews}
              unreadMsgCount={unreadMsgCount}
              onEditProfile={()=>navigate(`/judge/${judges.find(j=>j.id===user.judgeId)?.slug||user.judgeId}`)}
              onUserUpdated={u=>setUser(prev=>({...prev,...u}))}
            />
          : <Landing
              search={search} setSearch={setSearch}
              judges={judges} reviews={reviews}
              filtered={filtered}
              displayCount={displayCount} setDisplayCount={setDisplayCount}
              orgFilter={orgFilter} setOrgFilter={setOrgFilter}
              disciplineFilter={disciplineFilter} setDisciplineFilter={setDisciplineFilter}
              sort={sort} setSort={setSort}
              isMobile={isMobile} heroSearchRef={heroSearchRef}
              onNavigate={navigate}
              onManageCookies={manageCookies}
            />
          }/>
        <Route path="/judge/:slug" element={
          <JudgeRoute judges={judges} reviews={reviews} user={user}
            addReview={addReview}
            claimJudge={claimJudge} editProfile={editProfile} saveReply={saveReply}
            onRequestAuth={()=>setModal("auth")}
            onUserUpdated={u=>setUser(prev=>({...prev,...u}))}/>
        }/>
        <Route path="/messages" element={<MessagesRoute user={user}/>}/>
        <Route path="/admin" element={
          <AdminRoute judges={judges} reviews={reviews} user={user}
            patchJudge={(id,updates)=>setJudges(jj=>jj.map(j=>j.id===id?{...j,...updates}:j))}
            saveJudges={saveJudges} saveReviews={saveReviews}/>
        }/>
        <Route path="/contact" element={<ContactPage user={user}/>}/>
        <Route path="/settings" element={user ? <SettingsPage user={user} onUserUpdated={u=>setUser(prev=>({...prev,...u}))}/> : <Navigate to="/" replace/>}/>
        <Route path="/my-bookings" element={user ? <BookingsPage user={user}/> : <Navigate to="/" replace/>}/>
        <Route path="/privacy" element={<PrivacyPolicy/>}/>
        <Route path="/terms" element={<TermsOfService/>}/>
        <Route path="/cookies" element={<CookiePolicy/>}/>
        <Route path="/review-guidelines" element={<ReviewGuidelines/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes></div>

      {/* Footer — hidden on landing (it's embedded inside Landing) and on admin/messages */}
      {!["/admin","/messages"].some(p=>location.pathname.startsWith(p))
        && !(location.pathname==="/" && !search.trim() && orgFilter==="all" && disciplineFilter==="all" && !(user?.role==="judge"&&user?.judgeId))
        && <Footer onManageCookies={manageCookies}/>}
      </div>

      {cookieConsent===null&&<CookieBanner onAccept={acceptCookies} onDecline={declineCookies}/>}

      {modal==="auth"&&<AuthModal onClose={()=>setModal(null)} onAuth={u=>{setUser(u);setModal(null);}}/>}
      {modal==="consent"&&user?.needsConsent&&(
        <ConsentModal user={user} onClose={()=>{ firebaseSignOut(); setUser(null); setModal(null); }}
          onComplete={u=>{ setUser(u); setModal(null); }}/>
      )}
    </>
  );
}
