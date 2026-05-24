import { useState, useEffect, useCallback } from "react";
import { signInWithGoogle, firebaseSignOut, onAuthChange } from "./firebase";

const ORGS = {
  FCI:  { name: "Fédération Cynologique Internationale", short: "FCI",  color: "#1a73e8" },
  AKC:  { name: "American Kennel Club",                  short: "AKC",  color: "#e53935" },
  KC:   { name: "The Kennel Club (UK)",                  short: "KC",   color: "#1e8e3e" },
  CKC:  { name: "Canadian Kennel Club",                  short: "CKC",  color: "#f29900" },
  ANKC: { name: "Australian National Kennel Council",    short: "ANKC", color: "#9334e6" },
  JKC:  { name: "Japan Kennel Club",                     short: "JKC",  color: "#e52592" },
};

// All rating dimensions — single source of truth
const RATING_DIMS = [
  { key:"overall",              label:"Overall",                  group:"core" },
  { key:"breedKnowledge",       label:"Breed Knowledge",          group:"core" },
  { key:"consistency",          label:"Consistency & Fairness",   group:"core" },
  { key:"ringManner",           label:"Ring Manner",              group:"core" },
  { key:"examinationThoroughness", label:"Examination Thoroughness", group:"extra" },
  { key:"punctuality",          label:"Punctuality",              group:"extra" },
  { key:"noviceFriendliness",   label:"Novice Friendliness",      group:"extra" },
  { key:"handlerIndependence",  label:"Handler Independence",     group:"extra" },
  { key:"critiqueQuality",      label:"Critique Quality",         group:"extra" },
];

const EMPTY_RATINGS = Object.fromEntries(RATING_DIMS.map(d=>[d.key,0]));

const SEED_JUDGES = [
  { id:"j1", name:"Margaret Thornton", country:"USA", flag:"🇺🇸", breeds:["Golden Retriever","Labrador Retriever","Flat-Coated Retriever"], group:"Sporting", licensed:1994, orgs:[{org:"AKC",id:"AKC-28841"},{org:"FCI",id:"FCI-00412"}], verified:true, claimedBy:"judge1@example.com", bio:"Forty years in Goldens. I've bred 23 champions and judged on five continents. I judge for correct movement and coat texture above all else. An honest critique is the best thing I can give you.", social:{instagram:"@margaret_thornton_goldens",facebook:"MargaretThorntonGoldens",linkedin:""}, photo:"MT" },
  { id:"j2", name:"Hans-Werner Keller", country:"Germany", flag:"🇩🇪", breeds:["German Shepherd Dog","Rottweiler","Doberman Pinscher"], group:"Herding / Working", licensed:1988, orgs:[{org:"FCI",id:"FCI-00089"},{org:"KC",id:"KC-JG-1102"}], verified:true, claimedBy:"hw.keller@example.com", bio:"Former SV breed warden. I've judged the WUSV World Championship four times. What I look for: correct rear drive, solid nerves, and a head that screams the breed.", social:{instagram:"",facebook:"HWKellerJudge",linkedin:"hans-werner-keller"}, photo:"HK" },
  { id:"j3", name:"Siobhan O'Reilly", country:"Ireland", flag:"🇮🇪", breeds:["Irish Setter","Irish Water Spaniel","Kerry Blue Terrier"], group:"Sporting / Terrier", licensed:2001, orgs:[{org:"FCI",id:"FCI-01204"},{org:"KC",id:"KC-JG-2981"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"SR" },
  { id:"j4", name:"Takeshi Yamamoto", country:"Japan", flag:"🇯🇵", breeds:["Akita","Shiba Inu","Kishu Ken"], group:"Non-Sporting", licensed:1997, orgs:[{org:"JKC",id:"JKC-4421"},{org:"FCI",id:"FCI-00877"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"TY" },
  { id:"j5", name:"Eleanor Blackwood", country:"UK", flag:"🇬🇧", breeds:["Border Collie","Rough Collie","Shetland Sheepdog"], group:"Herding", licensed:1991, orgs:[{org:"KC",id:"KC-JG-0044"},{org:"FCI",id:"FCI-00201"}], verified:true, claimedBy:"eblackwood@example.com", bio:"Collies have been my life since 1979. I judge for the working whole — a dog that can do the job its ancestors were bred to do. I award the dog that could still herd a flock at the end of the day.", social:{instagram:"@eleanor_blackwood_collies",facebook:"",linkedin:""}, photo:"EB" },
  { id:"j6", name:"Carlos Mendes", country:"Brazil", flag:"🇧🇷", breeds:["Fila Brasileiro","Dogo Argentino","Cimarron Uruguayo"], group:"Working", licensed:2005, orgs:[{org:"FCI",id:"FCI-02210"},{org:"CKC",id:"CKC-J-9982"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"CM" },
  { id:"j7", name:"Patricia Van Houten", country:"Netherlands", flag:"🇳🇱", breeds:["Dutch Shepherd","Keeshond","Samoyed"], group:"Herding / Working", licensed:1999, orgs:[{org:"FCI",id:"FCI-00654"}], verified:true, claimedBy:"patricia.vh@example.com", bio:"I've dedicated my career to the preservation of correct Dutch and Nordic type. My assignments have taken me from Tokyo to São Paulo. I write detailed critiques for every class winner.", social:{instagram:"@patriciavh_dogs",facebook:"",linkedin:"patricia-van-houten-judge"}, photo:"PV" },
  { id:"j8", name:"Robert Ashford", country:"Australia", flag:"🇦🇺", breeds:["Australian Shepherd","Australian Cattle Dog","Kelpie"], group:"Herding", licensed:2003, orgs:[{org:"ANKC",id:"ANKC-J-3312"},{org:"FCI",id:"FCI-01899"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"RA" },
];

const SEED_REVIEWS = [
  { id:"r1", judgeId:"j1", userId:"u_s1", userName:"Sarah K.", breed:"Golden Retriever", show:"Westminster Invitational 2024", date:"2024-02-14", overall:5, breedKnowledge:5, consistency:4, ringManner:5, examinationThoroughness:5, punctuality:4, noviceFriendliness:5, handlerIndependence:4, critiqueQuality:5, wouldReturn:true, text:"Margaret is one of the best Golden judges on the circuit. She really understands correct movement and coat texture. Took her time with each dog, never felt rushed. My bitch went BOB and I felt it was completely deserved.", reply:null },
  { id:"r2", judgeId:"j1", userId:"u_s2", userName:"Tom B.", breed:"Labrador Retriever", show:"Crufts 2024", date:"2024-03-08", overall:4, breedKnowledge:5, consistency:3, ringManner:4, examinationThoroughness:4, punctuality:5, noviceFriendliness:4, handlerIndependence:3, critiqueQuality:4, wouldReturn:true, text:"Very knowledgeable on type, placed the correct dogs. A few placements in the class ring felt a bit inconsistent — the open bitch she put up first one class, then reversed with no clear reason. Still a solid judge.", reply:"Tom, thank you for the honest feedback. You're right that I reversed my open bitch placing — on second movement I saw a clear difference in rear extension that changed my mind. I should have been more consistent from the start." },
  { id:"r3", judgeId:"j2", userId:"u_s3", userName:"Lena W.", breed:"German Shepherd Dog", show:"Eurasia Show 2024", date:"2024-01-20", overall:5, breedKnowledge:5, consistency:5, ringManner:4, examinationThoroughness:5, punctuality:5, noviceFriendliness:3, handlerIndependence:5, critiqueQuality:5, wouldReturn:true, text:"Hans-Werner is the gold standard for GSD judging in Europe. His critiques were detailed and accurate. He rewarded correct angulation and did not fall for the overdone show dog look. Professional from start to finish.", reply:null },
  { id:"r4", judgeId:"j2", userId:"u_s4", userName:"Mike T.", breed:"Rottweiler", show:"German Sieger Show 2023", date:"2023-11-05", overall:3, breedKnowledge:4, consistency:2, ringManner:3, examinationThoroughness:3, punctuality:3, noviceFriendliness:2, handlerIndependence:2, critiqueQuality:3, wouldReturn:false, text:"Issues with consistency. Dogs he placed high in class were placed low in the group. I've shown under him twice and both times felt his final placements didn't match his initial selections.", reply:null },
  { id:"r5", judgeId:"j3", userId:"u_s5", userName:"Fiona M.", breed:"Irish Setter", show:"Clonmel Show 2024", date:"2024-06-02", overall:5, breedKnowledge:5, consistency:5, ringManner:5, examinationThoroughness:5, punctuality:5, noviceFriendliness:5, handlerIndependence:5, critiqueQuality:5, wouldReturn:true, text:"Siobhan is simply exceptional for the Irish breeds. She had my setter out and back twice, watched the whole class move together, and then made clean decisive placements. Written critiques are some of the best I've received.", reply:null },
  { id:"r6", judgeId:"j5", userId:"u_s6", userName:"Diana P.", breed:"Border Collie", show:"Scottish Kennel Club 2024", date:"2024-05-18", overall:5, breedKnowledge:5, consistency:5, ringManner:5, examinationThoroughness:5, punctuality:4, noviceFriendliness:5, handlerIndependence:5, critiqueQuality:5, wouldReturn:true, text:"Eleanor is a treat to show under. Genuine passion for herding dogs, and it shows. She rewarded working ability and correct structure. My youngster went Reserve and the critique was the most helpful feedback I've had all year.", reply:"Diana, thank you — this really means a lot. Your youngster was a standout in the class. Watch that left front — it's very minor but it will cost placements as she matures. A wonderful bitch." },
  { id:"r7", judgeId:"j7", userId:"u_s7", userName:"Anke V.", breed:"Keeshond", show:"Amsterdam Winner 2023", date:"2023-10-22", overall:5, breedKnowledge:5, consistency:5, ringManner:4, examinationThoroughness:5, punctuality:5, noviceFriendliness:4, handlerIndependence:5, critiqueQuality:5, wouldReturn:true, text:"Patricia is one of the most knowledgeable Dutch breed judges around. Thorough examination, clear in her reasoning. My Keeshond went BOB and she specifically called out his beautiful head and correct expression in the critique.", reply:null },
];

const K = { judges:"jyj_v4_judges", reviews:"jyj_v4_reviews", users:"jyj_v4_users", session:"jyj_v4_session", bookings:"jyj_v4_bookings" };
async function sGet(k,fb){ try{ const r=await window.storage.get(k); return r?JSON.parse(r.value):fb; }catch{ return fb; } }
async function sSet(k,v){ try{ await window.storage.set(k,JSON.stringify(v)); }catch{} }

const avg = a => a.filter(Boolean).length ? a.filter(Boolean).reduce((x,y)=>x+y,0)/a.filter(Boolean).length : 0;
const uid = () => Math.random().toString(36).slice(2,10);
const initials = n => n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
const AVATAR_COLORS = ["#1a73e8","#e53935","#1e8e3e","#f29900","#9334e6","#e52592","#00838f","#e65100"];
const aColor = s => { let h=0; for(let c of s) h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length; return AVATAR_COLORS[h]; };
const fmtDate = d => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});

const T = {
  bg:"#ffffff", surface:"#f8f9fa", surfaceHover:"#f1f3f4",
  border:"#e8eaed", text:"#202124", textSub:"#5f6368", textHint:"#9aa0a6",
  accent:"#1a73e8", accentLight:"#e8f0fe",
  green:"#1e8e3e", greenLight:"#e6f4ea",
  red:"#d93025", redLight:"#fce8e6",
  amber:"#f29900",
  r:12, rsm:8, rlg:20,
  shadow:"0 1px 3px rgba(60,64,67,.15), 0 1px 2px rgba(60,64,67,.10)",
  shadowMd:"0 4px 12px rgba(60,64,67,.15)",
  shadowLg:"0 8px 32px rgba(60,64,67,.18)",
};

// ── Atoms ──────────────────────────────────────────────────────────────────────
const Avatar = ({label,size=40}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:aColor(label),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.36,fontWeight:600,flexShrink:0}}>
    {label}
  </div>
);

const OrgPill = ({org}) => {
  const o = ORGS[org]||{short:org,color:"#5f6368"};
  return <span style={{display:"inline-flex",padding:"2px 8px",borderRadius:100,background:o.color,color:"#fff",fontSize:11,fontWeight:600,letterSpacing:0.2}}>{o.short}</span>;
};

const Chip = ({children,bg,color,small}) => (
  <span style={{display:"inline-flex",alignItems:"center",padding:small?"2px 8px":"4px 12px",borderRadius:100,background:bg||T.surface,color:color||T.textSub,fontSize:small?11:12,fontWeight:500,border:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
    {children}
  </span>
);

const Stars = ({val,onChange,size=18}) => {
  const [hov,setHov]=useState(0);
  return (
    <span style={{display:"inline-flex",gap:1,cursor:onChange?"pointer":"default"}}>
      {[1,2,3,4,5].map(i=>(
        <span key={i} style={{fontSize:size,color:(hov||val)>=i?"#f29900":"#dadce0",lineHeight:1,transition:"color .1s"}}
          onMouseEnter={()=>onChange&&setHov(i)} onMouseLeave={()=>onChange&&setHov(0)}
          onClick={()=>onChange&&onChange(i)}>★</span>
      ))}
    </span>
  );
};

const RatingBar = ({label,value,highlight}) => (
  <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:13,color:highlight?T.text:T.textSub,fontWeight:highlight?500:400}}>{label}</span>
      <span style={{fontSize:13,fontWeight:600,color:value?T.text:T.textHint}}>{value?value.toFixed(1):"—"}</span>
    </div>
    <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${(value/5)*100}%`,background:highlight?T.accent:"#80aaee",borderRadius:2,transition:"width .4s"}}/>
    </div>
  </div>
);

const SectionLabel = ({children}) => (
  <p style={{margin:"0 0 10px",fontSize:11,fontWeight:600,color:T.textHint,textTransform:"uppercase",letterSpacing:1}}>{children}</p>
);

const Divider = ({my=16}) => <div style={{height:1,background:T.border,margin:`${my}px 0`}}/>;

const Btn = ({children,onClick,variant="filled",color,small,fullWidth,icon,disabled}) => {
  const [hov,setHov]=useState(false);
  const styles = {
    filled:{bg:color||T.accent,text:"#fff",border:"none",hovBg:`${color||T.accent}dd`},
    tonal:{bg:T.accentLight,text:T.accent,border:"none",hovBg:"#d2e3fc"},
    outlined:{bg:"transparent",text:T.textSub,border:`1.5px solid ${T.border}`,hovBg:T.surface},
  };
  const s = styles[variant]||styles.filled;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:small?"6px 14px":"10px 22px",background:hov&&!disabled?s.hovBg:s.bg,color:disabled?"#9aa0a6":s.text,border:s.border||"none",borderRadius:100,fontSize:small?13:14,fontWeight:500,cursor:disabled?"not-allowed":"pointer",transition:"background .15s",width:fullWidth?"100%":"auto",letterSpacing:0.1,outline:"none",boxShadow:variant==="filled"&&!disabled?T.shadow:"none",fontFamily:"inherit"}}>
      {icon&&<span style={{fontSize:15,lineHeight:1}}>{icon}</span>}
      {children}
    </button>
  );
};

const Field = ({label,value,onChange,type="text",multiline,rows=4,placeholder,style:s}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...s}}>
    {label&&<label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2}}>{label}</label>}
    {multiline
      ? <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder}
          style={{padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:T.bg,resize:"vertical",outline:"none",color:T.text,lineHeight:1.6}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
      : <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          style={{padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.rsm,fontSize:14,fontFamily:"inherit",background:T.bg,outline:"none",color:T.text}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
    }
  </div>
);

// ── Modal ──────────────────────────────────────────────────────────────────────
const Modal = ({onClose,children,title,subtitle,wide}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.38)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(1px)"}}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:T.bg,borderRadius:T.rlg,width:"100%",maxWidth:wide?640:440,maxHeight:"92vh",overflowY:"auto",boxShadow:T.shadowLg,position:"relative"}}>
      <div style={{padding:"24px 24px 0",display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          {title&&<h2 style={{margin:"0 0 2px",fontSize:20,fontWeight:400,color:T.text,letterSpacing:-0.3}}>{title}</h2>}
          {subtitle&&<p style={{margin:0,fontSize:13,color:T.textSub}}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{background:T.surface,border:"none",cursor:"pointer",color:T.textSub,fontSize:16,width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12}}>✕</button>
      </div>
      <div style={{padding:"0 24px 24px"}}>{children}</div>
    </div>
  </div>
);

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function AuthModal({onClose,onAuth}) {
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  async function handleGoogle() {
    setLoading(true); setErr("");
    try {
      const user = await signInWithGoogle();
      onAuth(user); onClose();
    } catch(e) {
      setErr("Sign-in failed. Please try again.");
    }
    setLoading(false);
  }

  return (
    <Modal onClose={onClose} title="Sign in to judge.dog" subtitle="Rate judges, write reviews, book talent">
      <button onClick={handleGoogle} disabled={loading}
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",padding:"12px 16px",border:`1.5px solid ${T.border}`,borderRadius:100,background:T.bg,fontSize:14,fontWeight:500,color:T.text,cursor:loading?"not-allowed":"pointer",marginBottom:10,fontFamily:"inherit",transition:"background .15s",opacity:loading?0.6:1}}
        onMouseEnter={e=>!loading&&(e.currentTarget.style.background=T.surface)}
        onMouseLeave={e=>(e.currentTarget.style.background=T.bg)}>
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.7 0-14.3 4.6-17.7 11.7z"/><path fill="#FBBC05" d="M24 45c5.5 0 10.5-1.9 14.4-5l-6.7-5.5C29.6 36 26.9 37 24 37c-6 0-10.6-3.1-11.8-7.4l-7 5.4C8 41.2 15.4 45 24 45z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.4-2.4 4.4-4.4 5.8l6.7 5.5C42.3 36.2 45 30.6 45 24c0-1.4-.1-2.7-.5-4z"/></svg>
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
      <div style={{display:"flex",alignItems:"center",gap:10,margin:"8px 0 14px"}}>
        <div style={{flex:1,height:1,background:T.border}}/><span style={{fontSize:12,color:T.textHint}}>Facebook coming soon</span><div style={{flex:1,height:1,background:T.border}}/>
      </div>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <p style={{margin:"16px 0 0",fontSize:12,color:T.textHint,textAlign:"center",lineHeight:1.6}}>
        By signing in you agree to our terms. Your role defaults to <strong>Exhibitor</strong>.
      </p>
    </Modal>
  );
}

// ── Review Modal ───────────────────────────────────────────────────────────────
function ReviewModal({judge,user,onClose,onSubmit}) {
  const [f,setF]=useState({breed:"",show:"",wouldReturn:null,text:"",...EMPTY_RATINGS});
  const [err,setErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  async function submit() {
    setErr("");
    if (!f.breed.trim()||!f.show.trim()) { setErr("Please fill in breed and show name."); return; }
    const missing = RATING_DIMS.filter(d=>!f[d.key]);
    if (missing.length) { setErr(`Please rate: ${missing.map(d=>d.label).join(", ")}.`); return; }
    if (f.wouldReturn===null) { setErr("Please indicate if you'd show under them again."); return; }
    if (!f.text.trim()) { setErr("Please write a review."); return; }
    await onSubmit({id:uid(),judgeId:judge.id,userId:user.id,userName:user.name,date:new Date().toISOString().slice(0,10),reply:null,...f});
    onClose();
  }

  const coreDims = RATING_DIMS.filter(d=>d.group==="core");
  const extraDims = RATING_DIMS.filter(d=>d.group==="extra");

  const RatingGroup = ({dims}) => (
    <div style={{background:T.surface,borderRadius:T.rsm,overflow:"hidden",border:`1px solid ${T.border}`}}>
      {dims.map((d,i)=>(
        <div key={d.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:i<dims.length-1?`1px solid ${T.border}`:"none"}}>
          <span style={{fontSize:14,color:T.text}}>{d.label}</span>
          <Stars val={f[d.key]} onChange={v=>set(d.key,v)} size={22}/>
        </div>
      ))}
    </div>
  );

  return (
    <Modal onClose={onClose} title={`Review ${judge.name}`} subtitle="Your experience helps fellow exhibitors" wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Field label="Your breed" value={f.breed} onChange={e=>set("breed",e.target.value)} placeholder="e.g. Golden Retriever"/>
        <Field label="Show & year" value={f.show} onChange={e=>set("show",e.target.value)} placeholder="e.g. Crufts 2024"/>
      </div>

      <SectionLabel>Core ratings</SectionLabel>
      <div style={{marginBottom:14}}><RatingGroup dims={coreDims}/></div>

      <SectionLabel>Additional ratings</SectionLabel>
      <div style={{marginBottom:16}}><RatingGroup dims={extraDims}/></div>

      <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"0 0 8px"}}>Would you show under them again?</p>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[true,false].map(v=>(
          <button key={String(v)} onClick={()=>set("wouldReturn",v)}
            style={{flex:1,padding:"10px",borderRadius:100,border:`1.5px solid ${f.wouldReturn===v?(v?T.green:T.red):T.border}`,background:f.wouldReturn===v?(v?T.greenLight:T.redLight):T.bg,color:f.wouldReturn===v?(v?T.green:T.red):T.textSub,fontWeight:500,fontSize:14,cursor:"pointer",transition:"all .15s",fontFamily:"inherit"}}>
            {v?"✓  Yes":"✗  No"}
          </button>
        ))}
      </div>

      <Field label="Your review" multiline rows={5} value={f.text} onChange={e=>set("text",e.target.value)} placeholder="Describe the judging style, what they prioritised, ring management…" style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit}>Submit review</Btn>
    </Modal>
  );
}

// ── Booking Modal ──────────────────────────────────────────────────────────────
function BookingModal({judge,user,onClose,onSubmit}) {
  const [f,setF]=useState({showName:"",date:"",location:"",country:"",breeds:"",entries:"",feeDiscussion:"",message:""});
  const [done,setDone]=useState(false); const [err,setErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  async function submit() {
    setErr("");
    if (!f.showName.trim()||!f.date||!f.location.trim()||!f.breeds.trim()) { setErr("Please fill in all required fields."); return; }
    await onSubmit({id:uid(),judgeId:judge.id,organizerId:user.id,organizerName:user.name,status:"pending",submittedAt:new Date().toISOString(),...f});
    setDone(true);
  }
  if (done) return (
    <Modal onClose={onClose} title="Request sent">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>✓</div>
        <p style={{color:T.textSub,fontSize:14,lineHeight:1.7,margin:"0 0 20px"}}>Your booking request has been sent to <strong>{judge.name}</strong>.</p>
        <Btn onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );
  return (
    <Modal onClose={onClose} title="Request booking" subtitle={`Send a booking inquiry to ${judge.name}`} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Field label="Show name *" value={f.showName} onChange={e=>set("showName",e.target.value)}/>
        <Field label="Date *" type="date" value={f.date} onChange={e=>set("date",e.target.value)}/>
        <Field label="City / Venue *" value={f.location} onChange={e=>set("location",e.target.value)}/>
        <Field label="Country *" value={f.country} onChange={e=>set("country",e.target.value)}/>
        <Field label="Breeds to be judged *" value={f.breeds} onChange={e=>set("breeds",e.target.value)}/>
        <Field label="Expected entries" value={f.entries} onChange={e=>set("entries",e.target.value)} placeholder="Approx. number"/>
      </div>
      <Field label="Fee & travel" value={f.feeDiscussion} onChange={e=>set("feeDiscussion",e.target.value)} placeholder="Budget, travel covered, accommodation…" style={{marginBottom:12}}/>
      <Field label="Additional message" multiline rows={3} value={f.message} onChange={e=>set("message",e.target.value)} style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit}>Send request</Btn>
    </Modal>
  );
}

// ── Claim Modal ────────────────────────────────────────────────────────────────
function ClaimModal({judge,user,onClose,onClaim}) {
  const [input,setInput]=useState(""); const [err,setErr]=useState("");
  async function submit() {
    if (!judge.orgs.map(o=>o.id.toLowerCase()).includes(input.trim().toLowerCase())) { setErr("License number doesn't match our records."); return; }
    await onClaim(); onClose();
  }
  return (
    <Modal onClose={onClose} title="Claim this profile" subtitle="Verify your identity to manage this profile">
      <p style={{fontSize:13,color:T.textSub,lineHeight:1.7,margin:"0 0 16px"}}>Enter one of your official license numbers — e.g. <code style={{background:T.surface,padding:"1px 6px",borderRadius:4,fontSize:12}}>{judge.orgs[0]?.id}</code></p>
      <Field label="License number" value={input} onChange={e=>setInput(e.target.value)} placeholder={judge.orgs[0]?.id} style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit}>Verify & claim</Btn>
    </Modal>
  );
}

// ── Edit Profile Modal ─────────────────────────────────────────────────────────
function EditProfileModal({judge,onClose,onSave}) {
  const [bio,setBio]=useState(judge.bio||"");
  const [ig,setIg]=useState(judge.social?.instagram||"");
  const [fb,setFb]=useState(judge.social?.facebook||"");
  const [li,setLi]=useState(judge.social?.linkedin||"");
  async function save() { await onSave({...judge,bio,social:{instagram:ig,facebook:fb,linkedin:li}}); onClose(); }
  return (
    <Modal onClose={onClose} title="Edit profile" subtitle="Shown on your public judge profile" wide>
      <Field label="Bio" multiline rows={5} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Your background, philosophy, what you look for…" style={{marginBottom:16}}/>
      <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"0 0 8px"}}>Social links</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        <Field label="Instagram" value={ig} onChange={e=>setIg(e.target.value)} placeholder="@handle"/>
        <Field label="Facebook" value={fb} onChange={e=>setFb(e.target.value)} placeholder="Page name"/>
        <Field label="LinkedIn" value={li} onChange={e=>setLi(e.target.value)} placeholder="Username"/>
      </div>
      <Btn fullWidth onClick={save}>Save changes</Btn>
    </Modal>
  );
}

// ── Reply Modal ────────────────────────────────────────────────────────────────
function ReplyModal({review,onClose,onReply}) {
  const [text,setText]=useState(review.reply||""); const [err,setErr]=useState("");
  async function submit() { if (!text.trim()) { setErr("Reply cannot be empty."); return; } await onReply(review.id,text.trim()); onClose(); }
  return (
    <Modal onClose={onClose} title="Reply to review" subtitle={`Replying to ${review.userName}`}>
      <div style={{padding:"11px 14px",background:T.surface,borderRadius:T.rsm,fontSize:13,color:T.textSub,marginBottom:16,lineHeight:1.65,borderLeft:`3px solid ${T.border}`}}>
        "{review.text.slice(0,180)}{review.text.length>180?"…":""}"
      </div>
      <Field multiline rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="Write a professional, constructive reply…" style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit}>Post reply</Btn>
    </Modal>
  );
}

// ── Review Card ────────────────────────────────────────────────────────────────
function ReviewCard({review,isJudge,onReply}) {
  const [exp,setExp]=useState(false);
  const [showAll,setShowAll]=useState(false);
  const long=review.text.length>240;
  const extraDims = RATING_DIMS.filter(d=>d.group==="extra" && review[d.key]);
  return (
    <div style={{padding:"20px 0",borderBottom:`1px solid ${T.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Avatar label={initials(review.userName)} size={36}/>
          <div>
            <p style={{margin:0,fontWeight:500,color:T.text,fontSize:14}}>{review.userName}</p>
            <p style={{margin:0,fontSize:12,color:T.textHint}}>{review.breed} · {review.show}</p>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <Stars val={review.overall} size={14}/>
          <p style={{margin:"3px 0 0",fontSize:11,color:T.textHint}}>{fmtDate(review.date)}</p>
        </div>
      </div>

      {/* Core mini-ratings */}
      <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
        {RATING_DIMS.filter(d=>d.group==="core"&&d.key!=="overall"&&review[d.key]).map(d=>(
          <span key={d.key} style={{fontSize:12,color:T.textSub}}>{d.label}: <span style={{color:T.amber,fontWeight:600}}>{"★".repeat(review[d.key])}{"☆".repeat(5-review[d.key])}</span></span>
        ))}
      </div>

      {/* Extra ratings — collapsible */}
      {extraDims.length>0&&(
        <div style={{marginBottom:10}}>
          {showAll&&(
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:6}}>
              {extraDims.map(d=>(
                <span key={d.key} style={{fontSize:12,color:T.textSub}}>{d.label}: <span style={{color:T.amber,fontWeight:600}}>{"★".repeat(review[d.key])}{"☆".repeat(5-review[d.key])}</span></span>
              ))}
            </div>
          )}
          <button onClick={()=>setShowAll(!showAll)} style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",fontWeight:500}}>
            {showAll?"Hide additional ratings ▲":`Show ${extraDims.length} more ratings ▼`}
          </button>
        </div>
      )}

      <p style={{margin:"0 0 10px",color:T.text,fontSize:14,lineHeight:1.7}}>
        {long&&!exp?review.text.slice(0,240)+"…":review.text}
        {long&&<span style={{color:T.accent,cursor:"pointer",marginLeft:6,fontSize:13,fontWeight:500}} onClick={()=>setExp(!exp)}>{exp?"Less":"More"}</span>}
      </p>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:500,color:review.wouldReturn?T.green:T.red}}>
          {review.wouldReturn?"✓ Would show under again":"✗ Would not show under again"}
        </span>
        {isJudge&&!review.reply&&(
          <button onClick={()=>onReply(review)} style={{fontSize:13,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0,fontFamily:"inherit"}}>Reply</button>
        )}
      </div>

      {review.reply&&(
        <div style={{marginTop:12,padding:"12px 14px",background:T.surface,borderRadius:T.rsm,borderLeft:`3px solid ${T.accent}`}}>
          <p style={{margin:"0 0 4px",fontSize:12,fontWeight:600,color:T.accent}}>Judge's reply</p>
          <p style={{margin:0,fontSize:13,color:T.text,lineHeight:1.65}}>{review.reply}</p>
        </div>
      )}
    </div>
  );
}

// ── Judge Card ─────────────────────────────────────────────────────────────────
function JudgeCard({judge,reviews,onClick}) {
  const [hov,setHov]=useState(false);
  const rv=reviews.filter(r=>r.judgeId===judge.id);
  const oa=avg(rv.map(r=>r.overall));
  const wr=rv.filter(r=>r.wouldReturn).length;
  // Top 2 extra scores to surface on card
  const extraHighlights = RATING_DIMS.filter(d=>d.group==="extra").map(d=>({
    label:d.label, val:avg(rv.map(r=>r[d.key]||0))
  })).filter(x=>x.val>0).sort((a,b)=>b.val-a.val).slice(0,2);

  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:T.bg,borderRadius:T.r,padding:"18px",border:`1px solid ${hov?T.accent:T.border}`,cursor:"pointer",transition:"box-shadow .2s, border-color .2s",boxShadow:hov?T.shadowMd:T.shadow}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
        <div style={{position:"relative"}}>
          <Avatar label={judge.photo} size={44}/>
          {judge.verified&&<div style={{position:"absolute",bottom:-2,right:-2,width:15,height:15,background:T.green,borderRadius:"50%",border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff"}}>✓</div>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h3 style={{margin:"0 0 2px",fontSize:15,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{judge.flag} {judge.name}</h3>
          <p style={{margin:0,fontSize:12,color:T.textHint}}>{judge.country} · Since {judge.licensed}</p>
        </div>
        {rv.length>0&&(
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:17,fontWeight:600,color:T.text,lineHeight:1.2}}>{oa.toFixed(1)}</div>
            <Stars val={oa} size={10}/>
          </div>
        )}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {judge.orgs.map(o=><OrgPill key={o.org} org={o.org}/>)}
        <Chip small>{judge.group}</Chip>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:rv.length>0&&extraHighlights.length>0?10:12}}>
        {judge.breeds.slice(0,2).map(b=><Chip key={b} small>{b}</Chip>)}
        {judge.breeds.length>2&&<Chip small>+{judge.breeds.length-2}</Chip>}
      </div>
      {rv.length>0&&extraHighlights.length>0&&(
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {extraHighlights.map(x=>(
            <div key={x.label} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:100,background:T.surface,border:`1px solid ${T.border}`}}>
              <span style={{fontSize:11,color:T.textSub}}>{x.label}</span>
              <span style={{fontSize:11,fontWeight:600,color:T.accent}}>{x.val.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textHint,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
        <span>{rv.length} review{rv.length!==1?"s":""}</span>
        {rv.length>0&&<span style={{color:T.green,fontWeight:500}}>{Math.round(wr/rv.length*100)}% would return</span>}
        {rv.length===0&&<span style={{fontStyle:"italic"}}>No reviews yet</span>}
      </div>
    </div>
  );
}

// ── Judge Page ─────────────────────────────────────────────────────────────────
function JudgePage({judge,reviews,user,onBack,onReview,onBook,onClaim,onEditProfile,onSaveReply}) {
  const [modal,setModal]=useState(null); const [replyTarget,setReplyTarget]=useState(null);
  const rv=reviews.filter(r=>r.judgeId===judge.id).sort((a,b)=>b.date.localeCompare(a.date));
  const wr=rv.filter(r=>r.wouldReturn).length;
  const isOwner=user&&judge.claimedBy===user.email;
  const hasReviewed=user&&rv.some(r=>r.userId===user.id);
  const canBook=user&&user.role==="organizer"&&judge.verified;

  // Compute averages for all dims
  const dimAvgs = Object.fromEntries(RATING_DIMS.map(d=>[d.key, avg(rv.map(r=>r[d.key]||0))]));
  const coreDims = RATING_DIMS.filter(d=>d.group==="core");
  const extraDims = RATING_DIMS.filter(d=>d.group==="extra");

  return (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:8,position:"sticky",top:0,zIndex:100}}>
        <button onClick={onBack}
          style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14,fontWeight:500,padding:"7px 12px",borderRadius:100,fontFamily:"inherit",transition:"background .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background="none"}>
          ← Back
        </button>
        <span style={{fontSize:13,color:T.textHint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{judge.flag} {judge.name}</span>
      </div>

      <div style={{maxWidth:780,margin:"0 auto",padding:"32px 20px"}}>
        {/* Hero */}
        <div style={{display:"flex",gap:20,alignItems:"flex-start",marginBottom:24,flexWrap:"wrap"}}>
          <div style={{position:"relative"}}>
            <Avatar label={judge.photo} size={76}/>
            {judge.verified&&<div style={{position:"absolute",bottom:0,right:0,width:22,height:22,background:T.green,borderRadius:"50%",border:`3px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff"}}>✓</div>}
          </div>
          <div style={{flex:1,minWidth:180}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
              <h1 style={{margin:0,fontSize:24,fontWeight:400,color:T.text,letterSpacing:-0.4}}>{judge.flag} {judge.name}</h1>
              {judge.verified&&<Chip bg={T.greenLight} color={T.green} small>✓ Verified</Chip>}
            </div>
            <p style={{color:T.textSub,fontSize:13,margin:"0 0 10px"}}>{judge.country} · Licensed since {judge.licensed}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
              {judge.orgs.map(o=>(
                <div key={o.org} style={{display:"flex",alignItems:"center",gap:4}}>
                  <OrgPill org={o.org}/>
                  <code style={{fontSize:11,color:T.textHint,background:T.surface,padding:"1px 5px",borderRadius:4}}>{o.id}</code>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              <Chip small>{judge.group}</Chip>
              {judge.breeds.map(b=><Chip key={b} small>{b}</Chip>)}
            </div>
          </div>
          {rv.length>0&&(
            <div style={{textAlign:"center",background:T.surface,borderRadius:T.r,padding:"14px 22px",flexShrink:0,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:38,fontWeight:300,color:T.text,lineHeight:1,marginBottom:4}}>{dimAvgs.overall.toFixed(1)}</div>
              <Stars val={dimAvgs.overall} size={15}/>
              <div style={{fontSize:12,color:T.textHint,marginTop:5}}>{rv.length} review{rv.length!==1?"s":""}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
          {!hasReviewed&&<Btn onClick={onReview}>{user?"Write a review":"Sign in to review"}</Btn>}
          {hasReviewed&&<Chip bg={T.greenLight} color={T.green}>✓ Reviewed</Chip>}
          {canBook&&<Btn onClick={onBook} color={T.green} icon="📅">Request booking</Btn>}
          {!judge.verified&&user&&user.role==="judge"&&!judge.claimedBy&&<Btn onClick={onClaim} variant="outlined">Claim profile</Btn>}
          {isOwner&&<Btn onClick={onEditProfile} variant="outlined" icon="✏">Edit profile</Btn>}
          {!canBook&&user&&user.role==="organizer"&&!judge.verified&&<span style={{fontSize:13,color:T.textHint,alignSelf:"center"}}>Judge hasn't claimed their profile — bookings unavailable</span>}
        </div>

        {/* Bio */}
        {judge.bio&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
            <SectionLabel>About</SectionLabel>
            <p style={{color:T.text,fontSize:14,lineHeight:1.8,margin:0}}>{judge.bio}</p>
          </div>
        )}

        {/* Social */}
        {judge.social&&(judge.social.instagram||judge.social.facebook||judge.social.linkedin)&&(
          <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
            {judge.social.instagram&&<a href={`https://instagram.com/${judge.social.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:100,background:T.surface,color:T.text,textDecoration:"none",fontSize:13,border:`1px solid ${T.border}`,fontWeight:500}}>📷 {judge.social.instagram}</a>}
            {judge.social.facebook&&<a href={`https://facebook.com/${judge.social.facebook}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:100,background:T.surface,color:T.text,textDecoration:"none",fontSize:13,border:`1px solid ${T.border}`,fontWeight:500}}>f {judge.social.facebook}</a>}
            {judge.social.linkedin&&<a href={`https://linkedin.com/in/${judge.social.linkedin}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:100,background:T.surface,color:T.text,textDecoration:"none",fontSize:13,border:`1px solid ${T.border}`,fontWeight:500}}>in {judge.social.linkedin}</a>}
          </div>
        )}

        {/* Rating breakdown */}
        {rv.length>0&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:24,border:`1px solid ${T.border}`}}>
            <SectionLabel>Rating breakdown</SectionLabel>

            <p style={{fontSize:12,color:T.textSub,margin:"0 0 10px",fontWeight:500}}>Core</p>
            {coreDims.map(d=><RatingBar key={d.key} label={d.label} value={dimAvgs[d.key]} highlight={d.key==="overall"}/>)}

            <Divider my={14}/>
            <p style={{fontSize:12,color:T.textSub,margin:"0 0 10px",fontWeight:500}}>Additional</p>
            {extraDims.map(d=><RatingBar key={d.key} label={d.label} value={dimAvgs[d.key]}/>)}

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

// ── Admin Dashboard ────────────────────────────────────────────────────────────
function AdminDashboard({judges,reviews,bookings,user,onBack,onUpdateUser,onRemoveReview,onVerifyJudge}) {
  const [tab,setTab]=useState("overview");
  const [allUsers,setAllUsers]=useState([]);
  const [loadingUsers,setLoadingUsers]=useState(true);
  const [claimQueue,setClaimQueue]=useState([]);

  useEffect(()=>{
    // Load all users from Firestore
    (async()=>{
      try {
        const {db} = await import("./firebase");
        const {collection,getDocs} = await import("firebase/firestore");
        const snap = await getDocs(collection(db,"users"));
        const users = snap.docs.map(d=>({id:d.id,...d.data()}));
        setAllUsers(users);
      } catch(e){ console.error(e); }
      setLoadingUsers(false);
    })();
    // Find judges with pending claims (verified=false but claimedBy set)
    const pending = judges.filter(j=>j.claimedBy&&!j.verified);
    setClaimQueue(pending);
  },[judges]);

  async function changeRole(uid,newRole){
    try {
      const {db} = await import("./firebase");
      const {doc,updateDoc} = await import("firebase/firestore");
      await updateDoc(doc(db,"users",uid),{role:newRole});
      setAllUsers(prev=>prev.map(u=>u.id===uid?{...u,role:newRole}:u));
    } catch(e){ alert("Failed to update role"); }
  }

  async function suspendUser(uid,suspended){
    try {
      const {db} = await import("./firebase");
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
                    {["exhibitor","organizer","judge","admin"].map(r=><option key={r} value={r}>{r}</option>)}
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

        {/* Claims queue */}
        {tab==="claims"&&(
          <div style={{background:T.bg,borderRadius:T.r,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:14,fontWeight:500,color:T.text}}>Judge profile claims awaiting verification</span>
            </div>
            {claimQueue.length===0?(
              <div style={{padding:48,textAlign:"center",color:T.textHint,fontSize:13}}>No pending claims</div>
            ):claimQueue.map((j,i)=>(
              <div key={j.id} style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:i<claimQueue.length-1?`1px solid ${T.border}`:"none",flexWrap:"wrap"}}>
                <Avatar label={j.photo} size={40}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:14,fontWeight:500,color:T.text}}>{j.flag} {j.name}</p>
                  <p style={{margin:0,fontSize:12,color:T.textHint}}>{j.country} · {j.orgs.map(o=>o.id).join(", ")}</p>
                  <p style={{margin:"3px 0 0",fontSize:12,color:T.accent}}>Claimed by: {j.claimedBy}</p>
                </div>
                <div style={{display:"flex",gap:8"}}>
                  <button onClick={()=>onVerifyJudge(j.id,true)}
                    style={{padding:"7px 16px",borderRadius:100,border:"none",background:T.green,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                    ✓ Approve
                  </button>
                  <button onClick={()=>onVerifyJudge(j.id,false)}
                    style={{padding:"7px 16px",borderRadius:100,border:`1px solid ${T.red}`,background:"none",color:T.red,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reviews moderation */}
        {tab==="reviews"&&(
          <div style={{background:T.bg,borderRadius:T.r,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:14,fontWeight:500,color:T.text}}>All reviews</span>
              <span style={{fontSize:12,color:T.textHint}}>{reviews.length} total</span>
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

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [judges,setJudges]=useState([]); const [reviews,setReviews]=useState([]);
  const [bookings,setBookings]=useState([]); const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true); const [view,setView]=useState("list");
  const [selectedJudge,setSelectedJudge]=useState(null); const [modal,setModal]=useState(null);
  const [search,setSearch]=useState(""); const [sort,setSort]=useState("name"); const [orgFilter,setOrgFilter]=useState("all");

  useEffect(()=>{
    (async()=>{
      const sj=await sGet(K.judges,null); const sr=await sGet(K.reviews,null);
      const sb=await sGet(K.bookings,null);
      if(!sj){await sSet(K.judges,SEED_JUDGES);setJudges(SEED_JUDGES);}else setJudges(sj);
      if(!sr){await sSet(K.reviews,SEED_REVIEWS);setReviews(SEED_REVIEWS);}else setReviews(sr);
      if(!sb){await sSet(K.bookings,[]);setBookings([]);}else setBookings(sb);
      setLoading(false);
    })();
    // Listen to Firebase auth state
    const unsub = onAuthChange(u=>setUser(u));
    return ()=>unsub();
  },[]);

  const saveJudges=async jj=>{setJudges(jj);await sSet(K.judges,jj);};
  const saveReviews=async rr=>{setReviews(rr);await sSet(K.reviews,rr);};
  const saveBookings=async bb=>{setBookings(bb);await sSet(K.bookings,bb);};
  const addReview=useCallback(async r=>{const u=[...reviews,r];await saveReviews(u);},[reviews]);
  const addBooking=useCallback(async b=>{const u=[...bookings,b];await saveBookings(u);},[bookings]);

  const claimJudge=useCallback(async()=>{
    if(!selectedJudge||!user) return;
    const u=judges.map(j=>j.id===selectedJudge.id?{...j,verified:true,claimedBy:user.email}:j);
    await saveJudges(u); setSelectedJudge(u.find(j=>j.id===selectedJudge.id));
  },[judges,selectedJudge,user]);

  const editProfile=useCallback(async upd=>{
    const u=judges.map(j=>j.id===upd.id?upd:j);
    await saveJudges(u); setSelectedJudge(upd);
  },[judges]);

  const saveReply=useCallback(async(rid,text)=>{
    const u=reviews.map(r=>r.id===rid?{...r,reply:text}:r);
    await saveReviews(u);
  },[reviews]);

  const logout=async()=>{await firebaseSignOut();setUser(null);};

  const filtered=judges.filter(j=>{
    const q=search.toLowerCase();
    const mQ=!q||j.name.toLowerCase().includes(q)||j.country.toLowerCase().includes(q)||j.breeds.some(b=>b.toLowerCase().includes(q))||j.group.toLowerCase().includes(q);
    const mO=orgFilter==="all"||j.orgs.some(o=>o.org===orgFilter);
    return mQ&&mO;
  }).sort((a,b)=>{
    if(sort==="name") return a.name.localeCompare(b.name);
    const ra=reviews.filter(r=>r.judgeId===a.id),rb=reviews.filter(r=>r.judgeId===b.id);
    if(sort==="rating") return avg(rb.map(r=>r.overall||0))-avg(ra.map(r=>r.overall||0));
    if(sort==="reviews") return rb.length-ra.length;
    return 0;
  });

  if(loading) return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:T.textHint}}>Loading…</div>;

  const openJudge=j=>{setSelectedJudge(j);setView("judge");window.scrollTo(0,0);};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;600&family=Google+Sans+Text:wght@300;400;500&display=swap');
        *{box-sizing:border-box;} body{margin:0;background:${T.bg};font-family:'Google Sans Text','Segoe UI',system-ui,sans-serif;color:${T.text};-webkit-font-smoothing:antialiased;}
        input,textarea,button,select{font-family:inherit;}
        ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:${T.surface};} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
        select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235f6368'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px!important;}
      `}</style>

      {/* Nav */}
      <nav style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64,position:"sticky",top:0,zIndex:200}}>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>{setView("list");setSelectedJudge(null);}}>
          <svg width="38" height="38" viewBox="-55 -55 110 110" xmlns="http://www.w3.org/2000/svg">
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
          <span style={{fontSize:18,fontWeight:500,color:T.text,letterSpacing:-0.3,fontFamily:"'Google Sans',sans-serif"}}>judge.dog</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {user?(
            <>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px 5px 6px",borderRadius:100,background:T.surface,border:`1px solid ${T.border}`}}>
                {user.photo
                  ? <img src={user.photo} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover"}} alt=""/>
                  : <Avatar label={initials(user.name)} size={26}/>}
                <span style={{fontSize:13,color:T.textSub,fontWeight:500}}>{user.name.split(" ")[0]}</span>
              </div>
              <Btn onClick={logout} variant="outlined" small>Sign out</Btn>
              {user.role==="admin"&&<Btn onClick={()=>setView("admin")} variant="tonal" small>⚙ Admin</Btn>}
            </>
          ):(
            <Btn onClick={()=>setModal("auth")}>Sign in</Btn>
          )}
        </div>
      </nav>

      {view==="admin"&&user?.role==="admin"?(
        <AdminDashboard
          judges={judges} reviews={reviews} bookings={bookings} user={user}
          onBack={()=>setView("list")}
          onRemoveReview={async(rid)=>{
            if(!window.confirm("Remove this review?")) return;
            const u=reviews.filter(r=>r.id!==rid);
            await saveReviews(u);
          }}
          onVerifyJudge={async(jid,approve)=>{
            const u=judges.map(j=>j.id===jid?{...j,verified:approve,claimedBy:approve?j.claimedBy:null}:j);
            await saveJudges(u);
          }}
        />
      ):view==="judge"&&selectedJudge ? (
        <JudgePage judge={selectedJudge} reviews={reviews} user={user}
          onBack={()=>{setView("list");setSelectedJudge(null);}}
          onReview={()=>{if(!user){setModal("auth");}else{setModal("review");}}}
          onBook={()=>setModal("booking")}
          onClaim={()=>setModal("claim")}
          onEditProfile={()=>setModal("editProfile")}
          onSaveReply={saveReply}/>
      ):(
        <div style={{maxWidth:1040,margin:"0 auto",padding:"44px 20px"}}>
          <div style={{textAlign:"center",marginBottom:44}}>
            <h1 style={{fontSize:42,fontWeight:300,color:T.text,margin:"0 0 14px",letterSpacing:-1.2,lineHeight:1.15,fontFamily:"'Google Sans',sans-serif"}}>
              Know your judge<br/><span style={{fontWeight:500}}>before you enter.</span>
            </h1>
            <p style={{color:T.textSub,fontSize:16,maxWidth:420,margin:"0 auto",lineHeight:1.6,fontWeight:300}}>
              Real reviews from exhibitors worldwide. Verified judge profiles across FCI, AKC, KC and more.
            </p>
          </div>

          <div style={{maxWidth:720,margin:"0 auto 28px",display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:220,position:"relative"}}>
              <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.textHint,pointerEvents:"none",lineHeight:1}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search judges, breeds, countries…"
                style={{width:"100%",padding:"12px 16px 12px 42px",border:`1.5px solid ${T.border}`,borderRadius:100,fontSize:14,background:T.bg,outline:"none",color:T.text,boxSizing:"border-box",transition:"border-color .15s, box-shadow .15s"}}
                onFocus={e=>{e.target.style.borderColor=T.accent;e.target.style.boxShadow=`0 0 0 3px ${T.accentLight}`;}}
                onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow="none";}}/>
            </div>
            <select value={orgFilter} onChange={e=>setOrgFilter(e.target.value)}
              style={{padding:"12px 14px",border:`1.5px solid ${T.border}`,borderRadius:100,background:T.bg,fontSize:13,color:T.textSub,cursor:"pointer",outline:"none",minWidth:120}}>
              <option value="all">All orgs</option>
              {Object.keys(ORGS).map(o=><option key={o} value={o}>{o}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value)}
              style={{padding:"12px 14px",border:`1.5px solid ${T.border}`,borderRadius:100,background:T.bg,fontSize:13,color:T.textSub,cursor:"pointer",outline:"none",minWidth:150}}>
              <option value="name">Sort: Name</option>
              <option value="rating">Sort: Top rated</option>
              <option value="reviews">Sort: Most reviewed</option>
            </select>
          </div>

          <div style={{display:"flex",marginBottom:28,background:T.surface,borderRadius:T.r,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            {[["Judges",judges.length],["Reviews",reviews.length],["Organisations",Object.keys(ORGS).length],["Countries",[...new Set(judges.map(j=>j.country))].length]].map(([l,v],i,arr)=>(
              <div key={l} style={{flex:1,padding:"14px 20px",borderRight:i<arr.length-1?`1px solid ${T.border}`:"none",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:500,color:T.text,marginBottom:2,fontFamily:"'Google Sans',sans-serif"}}>{v}</div>
                <div style={{fontSize:12,color:T.textHint}}>{l}</div>
              </div>
            ))}
          </div>

          {filtered.length===0?(
            <div style={{textAlign:"center",padding:"64px 0",color:T.textHint}}>
              <div style={{fontSize:36,marginBottom:12}}>🔍</div>
              <p style={{fontSize:16,fontWeight:300,color:T.textSub}}>No judges found for "{search}"</p>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
              {filtered.map(j=><JudgeCard key={j.id} judge={j} reviews={reviews} onClick={()=>openJudge(j)}/>)}
            </div>
          )}
        </div>
      )}

      {modal==="auth"&&<AuthModal onClose={()=>setModal(null)} onAuth={u=>{setUser(u);setModal(null);}}/>}
      {modal==="review"&&selectedJudge&&user&&<ReviewModal judge={selectedJudge} user={user} onClose={()=>setModal(null)} onSubmit={addReview}/>}
      {modal==="booking"&&selectedJudge&&user&&<BookingModal judge={selectedJudge} user={user} onClose={()=>setModal(null)} onSubmit={addBooking}/>}
      {modal==="claim"&&selectedJudge&&user&&<ClaimModal judge={selectedJudge} user={user} onClose={()=>setModal(null)} onClaim={claimJudge}/>}
      {modal==="editProfile"&&selectedJudge&&<EditProfileModal judge={selectedJudge} onClose={()=>setModal(null)} onSave={editProfile}/>}
    </>
  );
}
