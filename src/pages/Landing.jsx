import { T, ORGS } from "../theme.js";
import { JudgeCard } from "../components/JudgeCard.jsx";
import { Footer } from "../components/Footer.jsx";

export function Landing({search, setSearch, judges, reviews, filtered, displayCount, setDisplayCount, orgFilter, setOrgFilter, sort, setSort, isMobile, heroSearchRef, onNavigate, onManageCookies}) {
  if (!search.trim()) {
    return (
      // height:100% fills the flex:1 Routes wrapper (which has height:0;minHeight:0)
      // so the full chain is: 100vh = nav(64px) + this div(100%) with no overflow
      <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>

        {/* Centered hero */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 20px",textAlign:"center"}}>

          {/* Logo + wordmark */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:isMobile?14:18}}>
            <svg width={isMobile?48:56} height={isMobile?48:56} viewBox="-55 -55 110 110" xmlns="http://www.w3.org/2000/svg">
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
            <span style={{fontSize:isMobile?36:44,fontWeight:700,color:T.text,letterSpacing:-1.2,fontFamily:"'Google Sans',sans-serif",lineHeight:1}}>
              judge<span style={{color:T.accent,fontWeight:400}}>.dog</span>
            </span>
          </div>

          {/* Slogan */}
          <p style={{fontSize:isMobile?14:17,color:T.textSub,fontWeight:300,margin:`0 0 ${isMobile?16:22}px`,letterSpacing:0.1}}>
            The professional network for dog judges
          </p>

          {/* Hero search bar */}
          <div style={{width:"100%",maxWidth:520,position:"relative",marginBottom:isMobile?14:18}}>
            <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.textHint,pointerEvents:"none",lineHeight:1}}>🔍</span>
            <input
              ref={heroSearchRef}
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search judges, breeds, countries…"
              style={{width:"100%",padding:"11px 18px 11px 42px",border:`1.5px solid ${T.border}`,borderRadius:100,fontSize:15,background:T.surface,outline:"none",color:T.text,boxSizing:"border-box",boxShadow:T.shadowSm,transition:"border-color .15s,box-shadow .15s"}}
              onFocus={e=>{e.target.style.borderColor=T.accent;e.target.style.boxShadow=`0 0 0 3px ${T.accentLight}`;}}
              onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow=T.shadowSm;}}
            />
          </div>

          {/* Three pillars — cards on desktop, single text row on mobile */}
          {isMobile ? (
            <p style={{fontSize:13,color:T.textHint,margin:"0 0 14px",letterSpacing:0.5}}>
              Find &nbsp;·&nbsp; Read &nbsp;·&nbsp; Book
            </p>
          ) : (
            <div style={{display:"flex",gap:12,maxWidth:600,margin:"0 0 20px"}}>
              {[
                {icon:"🔍",title:"Find",desc:"Search by name, breed, country or discipline"},
                {icon:"📖",title:"Read",desc:"Explore profiles, credentials and reviews"},
                {icon:"📅",title:"Book",desc:"Send a booking inquiry directly to the judge"},
              ].map(({icon,title,desc})=>(
                <div key={title} style={{flex:1,padding:"12px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.r,textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:5}}>{icon}</div>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3,fontFamily:"'Google Sans',sans-serif"}}>{title}</div>
                  <div style={{fontSize:11,color:T.textHint,lineHeight:1.45}}>{desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div style={{display:"flex",gap:isMobile?12:24,flexWrap:"wrap",justifyContent:"center",fontSize:12,color:T.textHint}}>
            <span><strong style={{color:T.textSub,fontWeight:500}}>{judges.filter(j=>!j.hidden).length.toLocaleString()}</strong> judges</span>
            <span style={{color:T.border}}>·</span>
            <span><strong style={{color:T.textSub,fontWeight:500}}>{[...new Set(judges.filter(j=>!j.hidden).map(j=>j.country))].length}</strong> countries</span>
            <span style={{color:T.border}}>·</span>
            <span>{Object.keys(ORGS).join(" · ")}</span>
          </div>

        </div>{/* end centered hero */}

        {/* Footer pinned at bottom — guarantees no page scroll on landing */}
        <Footer onManageCookies={onManageCookies}/>

      </div>
    );
  }

  // ── Results view ────────────────────────────────────────────────────────────
  return (
    <div style={{maxWidth:1040,margin:"0 auto",padding:"28px 20px"}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end",marginBottom:20}}>
        <select value={orgFilter} onChange={e=>setOrgFilter(e.target.value)}
          style={{padding:"7px 14px",border:`1.5px solid ${T.border}`,borderRadius:100,background:T.bg,fontSize:13,color:T.textSub,cursor:"pointer",outline:"none"}}>
          <option value="all">All orgs</option>
          {Object.keys(ORGS).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <select value={sort} onChange={e=>setSort(e.target.value)}
          style={{padding:"7px 14px",border:`1.5px solid ${T.border}`,borderRadius:100,background:T.bg,fontSize:13,color:T.textSub,cursor:"pointer",outline:"none"}}>
          <option value="name">Sort: Name</option>
          <option value="rating">Sort: Top rated</option>
          <option value="reviews">Sort: Most reviewed</option>
        </select>
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"64px 0",color:T.textHint}}>
          <div style={{fontSize:36,marginBottom:12}}>🔍</div>
          <p style={{fontSize:16,fontWeight:300,color:T.textSub}}>No judges found for "{search}"</p>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
            {filtered.slice(0,displayCount).map(j=><JudgeCard key={j.id} judge={j} reviews={reviews} onClick={()=>onNavigate("/judge/"+(j.slug||j.id))}/>)}
          </div>
          {filtered.length>displayCount&&(
            <div style={{textAlign:"center",marginTop:28}}>
              <button onClick={()=>setDisplayCount(n=>n+48)}
                style={{padding:"11px 28px",borderRadius:100,border:`1.5px solid ${T.border}`,background:T.bg,color:T.textSub,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit",transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                onMouseLeave={e=>e.currentTarget.style.background=T.bg}>
                Load more ({filtered.length-displayCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
