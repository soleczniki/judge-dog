import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from "react-router-dom";
import { signInWithGoogle, firebaseSignOut, onAuthChange } from "./firebase";
import { FCI_GROUP_NAMES, FCI_GROUP_BREEDS } from "../fci-groups.js";
import QRCode from "qrcode";

const tc = s => s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : "";

const isoFromLabel = label => {
  if (!label) return null;
  if (/^[A-Za-z]{2}$/.test(label)) return label.toUpperCase();
  const pts = [...label].map(c => c.codePointAt(0));
  if (pts.length >= 2 && pts[0] >= 0x1F1E6 && pts[0] <= 0x1F1FF)
    return String.fromCharCode(pts[0] - 0x1F1E6 + 65, pts[1] - 0x1F1E6 + 65);
  return null;
};
const countryISO = j => isoFromLabel(j.flag) || isoFromLabel(j.fciLicenceCountry) || null;

const ORGS = {
  FCI:  { name: "Fédération Cynologique Internationale", short: "FCI",  color: "#1a73e8" },
  AKC:  { name: "American Kennel Club",                  short: "AKC",  color: "#e53935" },
  KC:   { name: "The Kennel Club (UK)",                  short: "KC",   color: "#1e8e3e" },
  CKC:  { name: "Canadian Kennel Club",                  short: "CKC",  color: "#f29900" },
  ANKC: { name: "Australian National Kennel Council",    short: "ANKC", color: "#9334e6" },
  JKC:  { name: "Japan Kennel Club",                     short: "JKC",  color: "#e52592" },
};

// ── Discipline-based rating system ────────────────────────────────────────────
const UNIVERSAL_DIMS = [
  {key:"overall",        label:"Overall"},
  {key:"consistency",    label:"Consistency & Fairness"},
  {key:"professionalism",label:"Professionalism"},
];

const GROUP_DIMS = {
  A:[
    {key:"breedKnowledge",          label:"Breed Knowledge"},
    {key:"examinationThoroughness", label:"Examination Thoroughness"},
    {key:"ringManner",              label:"Ring Manner"},
    {key:"handlerIndependence",     label:"Handler Independence"},
    {key:"critiqueQuality",         label:"Critique Quality"},
    {key:"noviceFriendliness",      label:"Novice Friendliness"},
    {key:"punctuality",             label:"Punctuality"},
  ],
  B:[
    {key:"fieldKnowledge",      label:"Game & Field Knowledge"},
    {key:"testDesign",          label:"Test Design Quality"},
    {key:"scoringAccuracy",     label:"Scoring Accuracy"},
    {key:"terrainSelection",    label:"Terrain & Cover Selection"},
    {key:"dogWelfare",          label:"Dog Welfare Awareness"},
    {key:"handlerCommunication",label:"Handler Communication"},
  ],
  C:[
    {key:"rulebookKnowledge",   label:"Rulebook Knowledge"},
    {key:"scoringAccuracy",     label:"Scoring Accuracy"},
    {key:"ringSetup",           label:"Ring Setup"},
    {key:"briefingClarity",     label:"Briefing Clarity"},
    {key:"stressOnDogs",        label:"Stress on Dogs"},
    {key:"handlerCommunication",label:"Handler Communication"},
  ],
  D:[
    {key:"courseDesign",    label:"Course Design"},
    {key:"safetyAwareness", label:"Safety Awareness"},
    {key:"timingAccuracy",  label:"Timing & Technical Accuracy"},
    {key:"competitionFlow", label:"Flow of Competition"},
    {key:"briefingClarity", label:"Briefing Clarity"},
    {key:"dogWelfare",      label:"Dog Welfare Awareness"},
  ],
  E:[
    {key:"testDesign",             label:"Test Design Quality"},
    {key:"noseWorkKnowledge",      label:"Nose Work Knowledge"},
    {key:"scoringAccuracy",        label:"Scoring Accuracy"},
    {key:"environmentalAwareness", label:"Environmental Awareness"},
    {key:"briefingClarity",        label:"Briefing Clarity"},
    {key:"dogWelfare",             label:"Dog Welfare Awareness"},
  ],
  F:[
    {key:"workingKnowledge", label:"Working Knowledge"},
    {key:"testDesign",       label:"Test Design Quality"},
    {key:"scoringAccuracy",  label:"Scoring Accuracy"},
    {key:"dogWelfare",       label:"Dog Welfare Awareness"},
    {key:"stockEnvironment", label:"Stock & Environment Awareness"},
    {key:"briefingClarity",  label:"Briefing Clarity"},
  ],
  G:[
    {key:"breedTrimKnowledge",     label:"Breed Trim Knowledge"},
    {key:"technicalEye",           label:"Technical Eye"},
    {key:"breedStandardAlignment", label:"Breed Standard Alignment"},
    {key:"timeManagement",         label:"Time Management"},
    {key:"feedbackQuality",        label:"Feedback Quality"},
    {key:"dogWelfare",             label:"Dog Welfare Awareness"},
  ],
  H:[
    {key:"choreographyKnowledge",   label:"Choreography Knowledge"},
    {key:"technicalScoringAccuracy",label:"Technical Scoring Accuracy"},
    {key:"artisticAppreciation",    label:"Artistic Appreciation"},
    {key:"briefingClarity",         label:"Briefing Clarity"},
    {key:"dogWelfare",              label:"Dog Welfare Awareness"},
  ],
};

const GROUP_NAMES = {
  A:"Conformation & Shows", B:"Field Trials & Hunting",
  C:"Obedience & Precision Sports", D:"Agility & Speed Sports",
  E:"Nose Work & Tracking", F:"Working & Rescue",
  G:"Grooming", H:"Dog Dancing",
};

const ENTRY_LABELS = {
  A:{entry:"Your breed",   event:"Show & year"},
  B:{entry:"Your dog / entry",  event:"Event & year"},
  C:{entry:"Your dog / class",  event:"Event & year"},
  D:{entry:"Your dog / class",  event:"Event & year"},
  E:{entry:"Your dog / category",event:"Event & year"},
  F:{entry:"Your dog / class",  event:"Event & year"},
  G:{entry:"Breed / trim style", event:"Competition & year"},
  H:{entry:"Dog name / routine", event:"Competition & year"},
};

// All unique rating keys across all groups
const ALL_RATING_KEYS = [...new Set([
  ...UNIVERSAL_DIMS.map(d=>d.key),
  ...Object.values(GROUP_DIMS).flatMap(dims=>dims.map(d=>d.key)),
])];
const EMPTY_RATINGS = Object.fromEntries(ALL_RATING_KEYS.map(k=>[k,0]));

// Helper: get discipline group(s) for a judge (falls back to ["A"])
const judgeGroups = j => (j.disciplineGroups?.length ? j.disciplineGroups : ["A"]);

// Old-format review compatibility: detect if review was written before discipline groups
const reviewDims = r => {
  if (r.disciplineGroup) return [...UNIVERSAL_DIMS, ...(GROUP_DIMS[r.disciplineGroup]||GROUP_DIMS.A)];
  // legacy: return old keys that are present
  return [
    {key:"overall",label:"Overall"},{key:"breedKnowledge",label:"Breed Knowledge"},
    {key:"consistency",label:"Consistency & Fairness"},{key:"ringManner",label:"Ring Manner"},
    {key:"examinationThoroughness",label:"Examination Thoroughness"},
    {key:"punctuality",label:"Punctuality"},{key:"noviceFriendliness",label:"Novice Friendliness"},
    {key:"handlerIndependence",label:"Handler Independence"},{key:"critiqueQuality",label:"Critique Quality"},
  ].filter(d=>r[d.key]);
};

const SEED_JUDGES = [
  { id:"j1", slug:"margaret-thornton", name:"Margaret Thornton", country:"USA", flag:"🇺🇸", breeds:["Golden Retriever","Labrador Retriever","Flat-Coated Retriever"], group:"Sporting", licensed:1994, orgs:[{org:"AKC",id:"AKC-28841"},{org:"FCI",id:"FCI-00412"}], verified:true, claimedBy:"judge1@example.com", bio:"Forty years in Goldens. I've bred 23 champions and judged on five continents. I judge for correct movement and coat texture above all else. An honest critique is the best thing I can give you.", social:{instagram:"@margaret_thornton_goldens",facebook:"MargaretThorntonGoldens",linkedin:""}, photo:"MT" },
  { id:"j2", slug:"hans-werner-keller", name:"Hans-Werner Keller", country:"Germany", flag:"🇩🇪", breeds:["German Shepherd Dog","Rottweiler","Doberman Pinscher"], group:"Herding / Working", licensed:1988, orgs:[{org:"FCI",id:"FCI-00089"},{org:"KC",id:"KC-JG-1102"}], verified:true, claimedBy:"hw.keller@example.com", bio:"Former SV breed warden. I've judged the WUSV World Championship four times. What I look for: correct rear drive, solid nerves, and a head that screams the breed.", social:{instagram:"",facebook:"HWKellerJudge",linkedin:"hans-werner-keller"}, photo:"HK" },
  { id:"j3", slug:"siobhan-oreilly", name:"Siobhan O'Reilly", country:"Ireland", flag:"🇮🇪", breeds:["Irish Setter","Irish Water Spaniel","Kerry Blue Terrier"], group:"Sporting / Terrier", licensed:2001, orgs:[{org:"FCI",id:"FCI-01204"},{org:"KC",id:"KC-JG-2981"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"SR" },
  { id:"j4", slug:"takeshi-yamamoto", name:"Takeshi Yamamoto", country:"Japan", flag:"🇯🇵", breeds:["Akita","Shiba Inu","Kishu Ken"], group:"Non-Sporting", licensed:1997, orgs:[{org:"JKC",id:"JKC-4421"},{org:"FCI",id:"FCI-00877"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"TY" },
  { id:"j5", slug:"eleanor-blackwood", name:"Eleanor Blackwood", country:"UK", flag:"🇬🇧", breeds:["Border Collie","Rough Collie","Shetland Sheepdog"], group:"Herding", licensed:1991, orgs:[{org:"KC",id:"KC-JG-0044"},{org:"FCI",id:"FCI-00201"}], verified:true, claimedBy:"eblackwood@example.com", bio:"Collies have been my life since 1979. I judge for the working whole — a dog that can do the job its ancestors were bred to do. I award the dog that could still herd a flock at the end of the day.", social:{instagram:"@eleanor_blackwood_collies",facebook:"",linkedin:""}, photo:"EB" },
  { id:"j6", slug:"carlos-mendes", name:"Carlos Mendes", country:"Brazil", flag:"🇧🇷", breeds:["Fila Brasileiro","Dogo Argentino","Cimarron Uruguayo"], group:"Working", licensed:2005, orgs:[{org:"FCI",id:"FCI-02210"},{org:"CKC",id:"CKC-J-9982"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"CM" },
  { id:"j7", slug:"patricia-van-houten", name:"Patricia Van Houten", country:"Netherlands", flag:"🇳🇱", breeds:["Dutch Shepherd","Keeshond","Samoyed"], group:"Herding / Working", licensed:1999, orgs:[{org:"FCI",id:"FCI-00654"}], verified:true, claimedBy:"patricia.vh@example.com", bio:"I've dedicated my career to the preservation of correct Dutch and Nordic type. My assignments have taken me from Tokyo to São Paulo. I write detailed critiques for every class winner.", social:{instagram:"@patriciavh_dogs",facebook:"",linkedin:"patricia-van-houten-judge"}, photo:"PV" },
  { id:"j8", slug:"robert-ashford", name:"Robert Ashford", country:"Australia", flag:"🇦🇺", breeds:["Australian Shepherd","Australian Cattle Dog","Kelpie"], group:"Herding", licensed:2003, orgs:[{org:"ANKC",id:"ANKC-J-3312"},{org:"FCI",id:"FCI-01899"}], verified:false, claimedBy:null, bio:"", social:{}, photo:"RA" },
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

const K = { judges:"jyj_v5_judges", reviews:"jyj_v5_reviews", users:"jyj_v5_users", session:"jyj_v5_session", bookings:"jyj_v5_bookings" };
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
const Avatar = ({label, photoUrl, size=40}) => {
  if (photoUrl) return (
    <img src={photoUrl} alt={label||""}
      style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:`2px solid ${T.border}`}}/>
  );
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:aColor(label||"?"),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.36,fontWeight:600,flexShrink:0}}>
      {label||"?"}
    </div>
  );
};

const FlagImg = ({judge, height=14}) => {
  const iso = countryISO(judge);
  if (!iso) return null;
  return <img src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
              style={{height,width:"auto",borderRadius:2,verticalAlign:"middle",marginRight:4,flexShrink:0}}
              alt={iso}/>;
};

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

const InfoRow = ({label,value}) => {
  if (!value) return null;
  return (
    <div style={{display:"flex",gap:12,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
      <span style={{minWidth:168,fontSize:13,color:T.textHint,flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,color:T.text}}>{value}</span>
    </div>
  );
};

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
const Modal = ({onClose,children,title,subtitle,wide,confirmClose}) => {
  const handleBackdrop = e => {
    if (e.target !== e.currentTarget) return;
    if (confirmClose && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    onClose();
  };
  return (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.38)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(1px)"}}
    onClick={handleBackdrop}>
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
};

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
  const groups = judgeGroups(judge);
  const [selGroup,setSelGroup]=useState(groups[0]);
  const [f,setF]=useState({breed:"",show:"",wouldReturn:null,text:"",...EMPTY_RATINGS});
  const [err,setErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const specificDims = GROUP_DIMS[selGroup]||GROUP_DIMS.A;
  const allDims = [...UNIVERSAL_DIMS, ...specificDims];
  const labels = ENTRY_LABELS[selGroup]||ENTRY_LABELS.A;

  async function submit() {
    setErr("");
    if (!f.breed.trim()||!f.show.trim()) { setErr(`Please fill in ${labels.entry.toLowerCase()} and ${labels.event.toLowerCase()}.`); return; }
    const missing = allDims.filter(d=>!f[d.key]);
    if (missing.length) { setErr(`Please rate: ${missing.map(d=>d.label).join(", ")}.`); return; }
    if (f.wouldReturn===null) { setErr("Please indicate if you'd compete/show under them again."); return; }
    if (!f.text.trim()) { setErr("Please write a review."); return; }
    await onSubmit({id:uid(),judgeId:judge.id,userId:user.id,userName:user.name,
      date:new Date().toISOString().slice(0,10),reply:null,disciplineGroup:selGroup,...f});
    onClose();
  }

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
      {/* Discipline group selector — only shown when judge has multiple groups */}
      {groups.length>1&&(
        <div style={{marginBottom:16}}>
          <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"0 0 8px"}}>Which discipline are you reviewing?</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {groups.map(g=>(
              <button key={g} onClick={()=>setSelGroup(g)}
                style={{padding:"6px 14px",borderRadius:100,border:`1.5px solid ${selGroup===g?T.accent:T.border}`,background:selGroup===g?T.accentLight:T.bg,color:selGroup===g?T.accent:T.textSub,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                {GROUP_NAMES[g]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Field label={labels.entry} value={f.breed} onChange={e=>set("breed",e.target.value)} placeholder={selGroup==="A"?"e.g. Golden Retriever":"e.g. Max / Open class"}/>
        <Field label={labels.event} value={f.show} onChange={e=>set("show",e.target.value)} placeholder={selGroup==="A"?"e.g. Crufts 2024":"e.g. National Championship 2024"}/>
      </div>

      <SectionLabel>Universal criteria</SectionLabel>
      <div style={{marginBottom:14}}><RatingGroup dims={UNIVERSAL_DIMS}/></div>

      <SectionLabel>{GROUP_NAMES[selGroup]} criteria</SectionLabel>
      <div style={{marginBottom:16}}><RatingGroup dims={specificDims}/></div>

      <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"0 0 8px"}}>Would you compete / show under them again?</p>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[true,false].map(v=>(
          <button key={String(v)} onClick={()=>set("wouldReturn",v)}
            style={{flex:1,padding:"10px",borderRadius:100,border:`1.5px solid ${f.wouldReturn===v?(v?T.green:T.red):T.border}`,background:f.wouldReturn===v?(v?T.greenLight:T.redLight):T.bg,color:f.wouldReturn===v?(v?T.green:T.red):T.textSub,fontWeight:500,fontSize:14,cursor:"pointer",transition:"all .15s",fontFamily:"inherit"}}>
            {v?"✓  Yes":"✗  No"}
          </button>
        ))}
      </div>

      <Field label="Your review" multiline rows={5} value={f.text} onChange={e=>set("text",e.target.value)} placeholder="Describe the judging style, what they prioritised, how they ran the ring…" style={{marginBottom:16}}/>
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
function ClaimModal({judge,user,onClose}) {
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);
  const [err,setErr]=useState("");

  async function submit() {
    setSending(true); setErr("");
    try {
      const {db}=await import("./firebase");
      const {doc,setDoc}=await import("firebase/firestore");
      // Deterministic ID: one claim per user per judge, setDoc overwrites if re-submitted
      await setDoc(doc(db,"claims",`${judge.id}__${user.uid}`),{
        judgeId:judge.id, judgeName:judge.name, judgeSlug:judge.slug||judge.id,
        userId:user.uid, userName:user.name, userEmail:user.email,
        status:"pending", submittedAt:new Date().toISOString(),
      });
      setDone(true);
    } catch(e){console.error(e);setErr("Failed to submit — please try again.");}
    setSending(false);
  }

  if(done) return (
    <Modal onClose={onClose} title="Claim submitted">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>✓</div>
        <p style={{fontSize:15,fontWeight:500,color:T.text,margin:"0 0 8px"}}>Request received</p>
        <p style={{fontSize:13,color:T.textSub,margin:"0 0 24px",lineHeight:1.6}}>We'll review your claim and approve it shortly. Once approved you'll have full access to your profile.</p>
        <Btn onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} title="Claim this profile" subtitle={`Are you ${judge.name}?`}>
      <p style={{fontSize:13,color:T.textSub,lineHeight:1.7,margin:"0 0 20px"}}>Once approved you'll be able to manage your profile, reply to reviews, and receive messages directly from exhibitors and show organisers.</p>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={submit} disabled={sending}>{sending?"Submitting…":"Submit claim request"}</Btn>
    </Modal>
  );
}

// ── Contact Modal ─────────────────────────────────────────────────────────────
function ContactModal({judge,user,onClose}) {
  const [name,setName]=useState(user?.name||"");
  const [email,setEmail]=useState(user?.email||"");
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState("");

  const send=async()=>{
    if(!name.trim()||!email.trim()||!message.trim()){setErr("Please fill in all fields.");return;}
    setSending(true); setErr("");
    try {
      const {db}=await import("./firebase");
      const {collection,addDoc}=await import("firebase/firestore");
      await addDoc(collection(db,"messages"),{
        judgeId:judge.id, judgeName:judge.name, judgeSlug:judge.slug||judge.id,
        fromName:name.trim(), fromEmail:email.trim(),
        message:message.trim(), sentAt:new Date().toISOString(),
        read:false, claimed:!!judge.claimedBy,
      });
      setSent(true);
    } catch(e){console.error(e);setErr("Failed to send — please try again.");}
    setSending(false);
  };

  if(sent) return (
    <Modal onClose={onClose} title="Message sent">
      <div style={{textAlign:"center",padding:"12px 0 8px"}}>
        <div style={{fontSize:40,marginBottom:14}}>✓</div>
        <p style={{fontSize:15,color:T.text,margin:"0 0 8px",fontWeight:500}}>Your message has been sent</p>
        <p style={{fontSize:13,color:T.textSub,margin:"0 0 24px",lineHeight:1.6}}>
          {judge.claimedBy
            ? `${judge.name} will receive your message on judge.dog.`
            : `We'll forward your message to ${judge.name}'s registered email. They may not have joined judge.dog yet.`}
        </p>
        <Btn onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} title={`Contact ${judge.name}`}
      subtitle={judge.claimedBy?"The judge will receive your message.":"This judge hasn't joined judge.dog yet — we'll forward your message to their registered email."}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <Field label="Your name" value={name} onChange={e=>setName(e.target.value)}/>
        <Field label="Your email" value={email} onChange={e=>setEmail(e.target.value)} type="email"/>
      </div>
      <Field label="Message" multiline rows={5} value={message} onChange={e=>setMessage(e.target.value)}
        placeholder={`Write your message to ${judge.name}…`} style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={send} disabled={sending}>{sending?"Sending…":"Send message"}</Btn>
    </Modal>
  );
}

// ── Edit Profile Modal ─────────────────────────────────────────────────────────
const withTimeout=(promise,ms,msg)=>Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error(msg)),ms))]);

function EditProfileModal({judge,onClose,onSave}) {
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
      const {uploadPhoto}=await import("./firebase");
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
        const {uploadPhoto}=await import("./firebase");
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22}}>
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
  const dims = reviewDims(review).filter(d=>d.key!=="overall"&&review[d.key]);
  const primary = dims.slice(0,3);
  const extra   = dims.slice(3);
  return (
    <div style={{padding:"20px 0",borderBottom:`1px solid ${T.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Avatar label={initials(review.userName)} size={36}/>
          <div>
            <p style={{margin:0,fontWeight:500,color:T.text,fontSize:14}}>{review.userName}</p>
            <p style={{margin:0,fontSize:12,color:T.textHint}}>
              {review.breed} · {review.show}
              {review.disciplineGroup&&<span style={{marginLeft:6,padding:"1px 6px",borderRadius:100,background:T.surface,border:`1px solid ${T.border}`,fontSize:11}}>{GROUP_NAMES[review.disciplineGroup]}</span>}
            </p>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <Stars val={review.overall} size={14}/>
          <p style={{margin:"3px 0 0",fontSize:11,color:T.textHint}}>{fmtDate(review.date)}</p>
        </div>
      </div>

      {/* Primary mini-ratings */}
      <div style={{display:"flex",gap:14,marginBottom:8,flexWrap:"wrap"}}>
        {primary.map(d=>(
          <span key={d.key} style={{fontSize:12,color:T.textSub}}>{d.label}: <span style={{color:T.amber,fontWeight:600}}>{"★".repeat(review[d.key])}{"☆".repeat(5-review[d.key])}</span></span>
        ))}
      </div>

      {/* Extra ratings — collapsible */}
      {extra.length>0&&(
        <div style={{marginBottom:10}}>
          {showAll&&(
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:6}}>
              {extra.map(d=>(
                <span key={d.key} style={{fontSize:12,color:T.textSub}}>{d.label}: <span style={{color:T.amber,fontWeight:600}}>{"★".repeat(review[d.key])}{"☆".repeat(5-review[d.key])}</span></span>
              ))}
            </div>
          )}
          <button onClick={()=>setShowAll(!showAll)} style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",fontWeight:500}}>
            {showAll?"Hide additional ratings ▲":`Show ${extra.length} more ratings ▼`}
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

// ── Collapsible breed chip list ────────────────────────────────────────────────
const BREEDS_PREVIEW = 10;
function BreedList({breeds, label}) {
  const [expanded, setExpanded] = useState(false);
  if (!breeds?.length) return null;
  const shown = expanded ? breeds : breeds.slice(0, BREEDS_PREVIEW);
  const extra = breeds.length - BREEDS_PREVIEW;
  return (
    <>
      {label && <p style={{fontSize:12,fontWeight:500,color:T.textSub,margin:"14px 0 8px"}}>{label}</p>}
      <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
        {shown.map(b=><Chip key={b} small>{b}</Chip>)}
        {!expanded && extra>0 && (
          <button onClick={()=>setExpanded(true)}
            style={{fontSize:12,color:T.accent,background:"none",border:`1px solid ${T.border}`,borderRadius:100,padding:"2px 10px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            +{extra} more
          </button>
        )}
        {expanded && breeds.length>BREEDS_PREVIEW && (
          <button onClick={()=>setExpanded(false)}
            style={{fontSize:12,color:T.textHint,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:"2px 4px"}}>
            show less
          </button>
        )}
      </div>
    </>
  );
}

// ── Group Section (expandable breed list) ─────────────────────────────────────
function GroupSection({groupNum, groupName}) {
  const [open,setOpen]=useState(false);
  const breeds = FCI_GROUP_BREEDS[groupNum] || [];
  return (
    <div style={{border:`1px solid ${T.border}`,borderRadius:T.rsm,marginBottom:6,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)}
        style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:open?T.accentLight:T.bg,border:"none",cursor:"pointer",fontFamily:"inherit",transition:"background .15s"}}>
        <span style={{fontSize:14,fontWeight:500,color:T.text}}>Group {groupNum} — {groupName}</span>
        <span style={{fontSize:12,color:T.textHint,display:"flex",alignItems:"center",gap:6}}>
          {breeds.length} breeds
          <span style={{fontSize:10,color:T.accent}}>{open?"▲":"▼"}</span>
        </span>
      </button>
      {open&&(
        <div style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,display:"flex",flexWrap:"wrap",gap:4,background:T.surface}}>
          {breeds.map(b=><Chip key={b} small>{b}</Chip>)}
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

  // Breed/group summary for card
  const breedSummary = () => {
    if (judge.allBreedJudge) return <Chip small bg={T.greenLight} color={T.green}>All breeds</Chip>;
    if (judge.groupNames?.length) return (
      <>
        {judge.groupNames.slice(0,4).map(g=><Chip key={g.group} small>Group {g.group}</Chip>)}
        {judge.groupNames.length>4&&<Chip small>+{judge.groupNames.length-4} groups</Chip>}
        {judge.authorizedBreeds?.length>0&&<Chip small>+{judge.authorizedBreeds.length} breeds</Chip>}
      </>
    );
    if (judge.breeds?.length) return (
      <>
        {judge.breeds.slice(0,2).map(b=><Chip key={b} small>{b}</Chip>)}
        {judge.breeds.length>2&&<Chip small>+{judge.breeds.length-2}</Chip>}
      </>
    );
    return <Chip small color={T.textHint}>No breed data</Chip>;
  };

  const disciplineLabel = judge.disciplines?.length ? judge.disciplines[0] : (judge.group||"Shows");

  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:T.bg,borderRadius:T.r,padding:"18px",border:`1px solid ${hov?T.accent:T.border}`,cursor:"pointer",transition:"box-shadow .2s, border-color .2s",boxShadow:hov?T.shadowMd:T.shadow,overflow:"hidden"}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
        <div style={{position:"relative",flexShrink:0}}>
          <Avatar label={judge.photo} size={44}/>
          {judge.verified&&<div style={{position:"absolute",bottom:-2,right:-2,width:15,height:15,background:T.green,borderRadius:"50%",border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff"}}>✓</div>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h3 style={{margin:"0 0 2px",fontSize:15,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center"}}><FlagImg judge={judge}/>{judge.name}</h3>
          <p style={{margin:0,fontSize:12,color:T.textHint}}>
            {judge.country}
            {judge.birthYear&&<> · Born {judge.birthYear}</>}
            {judge.licensedYear&&<> · Lic. {judge.licensedYear}</>}
          </p>
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
        <Chip small>{disciplineLabel}</Chip>
        {judge.bisJudge&&<Chip bg="#fff8e1" color="#f57f17" small>★ BIS</Chip>}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
        {breedSummary()}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textHint,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
        {rv.length===0
          ? <span style={{fontStyle:"italic"}}>No reviews yet</span>
          : <>
              <span>{rv.length} review{rv.length!==1?"s":""}</span>
              <span style={{color:T.green,fontWeight:500}}>{Math.round(wr/rv.length*100)}% would return</span>
            </>
        }
      </div>
    </div>
  );
}

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
  const canBook=user&&user.role==="organizer"&&judge.verified;

  const [claimStatus,setClaimStatus]=useState(null);
  useEffect(()=>{
    if(!user||judge.claimedBy) return;
    (async()=>{
      try {
        const {db}=await import("./firebase");
        const {doc,getDoc}=await import("firebase/firestore");
        const snap=await getDoc(doc(db,"claims",`${judge.id}__${user.uid}`));
        if(snap.exists()) setClaimStatus(snap.data().status);
      } catch(e){}
    })();
  },[user,judge.id,judge.claimedBy]);

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
            {/* FCI licence */}
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
              {judge.orgs.map(o=>(
                <div key={o.org} style={{display:"flex",alignItems:"center",gap:4}}>
                  <OrgPill org={o.org}/>
                  <code style={{fontSize:11,color:T.textHint,background:T.surface,padding:"1px 5px",borderRadius:4}}>{o.id}</code>
                </div>
              ))}
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
          {!isOwner&&!claimStatus&&<Btn onClick={onContact} variant="outlined">Contact</Btn>}
          {isOwner&&<Btn onClick={onEditProfile} variant="outlined" icon="✏">Edit profile</Btn>}
        </div>

        {/* Official Details */}
        {(judge.kennelClub||judge.fciLanguages?.length>0||judge.otherLanguages?.length>0||judge.kennelName)&&(
          <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
            <SectionLabel>Official details</SectionLabel>
            <div style={{marginTop:-4}}>
              <InfoRow label="Country of legal residence" value={judge.countryOfResidence||judge.country}/>
              <InfoRow label="National kennel club" value={judge.kennelClub}/>
              <InfoRow label="FCI languages" value={judge.fciLanguages?.length>0?judge.fciLanguages.join(", "):null}/>
              <InfoRow label="Other languages" value={judge.otherLanguages?.length>0?judge.otherLanguages.join(", "):null}/>
              <InfoRow label="FCI kennel name" value={judge.kennelName}/>
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
          const groupCovered=new Set((judge.groupNames||[]).flatMap(g=>(FCI_GROUP_BREEDS[g.group]||[]).map(b=>b.toLowerCase())));
          const extra=(judge.breeds||[]).filter(b=>!groupCovered.has(b.toLowerCase()));
          return (
            <div style={{background:T.surface,borderRadius:T.r,padding:"18px 20px",marginBottom:18,border:`1px solid ${T.border}`}}>
              <SectionLabel>Breed authorizations</SectionLabel>
              {judge.allBreedJudge ? (
                <Chip bg={T.greenLight} color={T.green}>All breeds</Chip>
              ) : judge.groupNames?.length>0 ? (
                <>
                  {judge.groupNames.map(g=><GroupSection key={g.group} groupNum={g.group} groupName={g.name}/>)}
                  {extra.length>0&&<BreedList breeds={extra} label="Additional individual breeds"/>}
                </>
              ) : judge.breeds?.length>0 ? (
                <BreedList breeds={judge.breeds}/>
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

// ── Admin Dashboard ────────────────────────────────────────────────────────────
function AdminDashboard({judges,reviews,bookings,user,onBack,onUpdateUser,onRemoveReview,onVerifyJudge}) {
  const [tab,setTab]=useState("overview");
  const [allUsers,setAllUsers]=useState([]);
  const [loadingUsers,setLoadingUsers]=useState(true);
  const [claimQueue,setClaimQueue]=useState([]);

  useEffect(()=>{
    (async()=>{
      try {
        const {db} = await import("./firebase");
        const {collection,getDocs,query,where} = await import("firebase/firestore");
        // Run independently so one failure doesn't kill the other
        const [usersResult,claimsResult] = await Promise.allSettled([
          getDocs(collection(db,"users")),
          getDocs(query(collection(db,"claims"),where("status","==","pending"))),
        ]);
        if(usersResult.status==="fulfilled") setAllUsers(usersResult.value.docs.map(d=>({id:d.id,...d.data()})));
        if(claimsResult.status==="fulfilled") setClaimQueue(claimsResult.value.docs.map(d=>({id:d.id,...d.data()})));
        else console.error("Claims load failed:",claimsResult.reason);
      } catch(e){ console.error(e); }
      setLoadingUsers(false);
    })();
  },[]);

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
              <span style={{fontSize:14,fontWeight:500,color:T.text}}>Pending profile claims</span>
            </div>
            {claimQueue.length===0?(
              <div style={{padding:48,textAlign:"center",color:T.textHint,fontSize:13}}>No pending claims</div>
            ):claimQueue.map((claim,i)=>(
              <div key={claim.id} style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:i<claimQueue.length-1?`1px solid ${T.border}`:"none",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:14,fontWeight:500,color:T.text}}>
                    <span style={{color:T.accent}}>{claim.userName}</span>
                    <span style={{color:T.textHint,fontWeight:400}}> claims to be </span>
                    <a href={`/judge/${claim.judgeSlug}`} target="_blank" rel="noreferrer" style={{color:T.text,textDecoration:"underline",textDecorationColor:T.border}}>{claim.judgeName}</a>
                  </p>
                  <p style={{margin:"2px 0 0",fontSize:12,color:T.textHint}}>{claim.userEmail} · {new Date(claim.submittedAt).toLocaleString()}</p>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={async()=>{await onVerifyJudge(claim,true);setClaimQueue(q=>q.filter(c=>c.judgeId!==claim.judgeId));}}
                    style={{padding:"7px 16px",borderRadius:100,border:"none",background:T.green,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                    ✓ Approve
                  </button>
                  <button onClick={async()=>{await onVerifyJudge(claim,false);setClaimQueue(q=>q.filter(c=>c.id!==claim.id));}}
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

// ── Scroll restoration ─────────────────────────────────────────────────────────
function ScrollToTop() {
  const {pathname}=useLocation();
  useEffect(()=>{ window.scrollTo(0,0); },[pathname]);
  return null;
}

// ── Judge Route ────────────────────────────────────────────────────────────────
function JudgeRoute({judges,reviews,user,addReview,addBooking,claimJudge,editProfile,saveReply,onRequestAuth}) {
  const {slug}=useParams();
  const navigate=useNavigate();
  const [modal,setModal]=useState(null);
  const judge=judges.find(j=>j.slug===slug||j.id===slug);

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
      <JudgePage judge={judge} reviews={reviews} user={user}
        onBack={()=>navigate(-1)}
        onReview={()=>{if(!user){onRequestAuth();}else{setModal("review");}}}
        onBook={()=>setModal("booking")}
        onClaim={()=>setModal("claim")}
        onContact={handleContact}
        onEditProfile={()=>setModal("editProfile")}
        onSaveReply={saveReply}
        onRequestAuth={onRequestAuth}/>
      {modal==="review"&&user&&<ReviewModal judge={judge} user={user} onClose={()=>setModal(null)} onSubmit={addReview}/>}
      {modal==="booking"&&user&&<BookingModal judge={judge} user={user} onClose={()=>setModal(null)} onSubmit={addBooking}/>}
      {modal==="claim"&&user&&<ClaimModal judge={judge} user={user} onClose={()=>setModal(null)}/>}
      {modal==="contact"&&<ContactModal judge={judge} user={user} onClose={()=>setModal(null)}/>}
      {modal==="startConv"&&user&&<StartConvModal judge={judge} user={user} onClose={()=>setModal(null)} onCreated={()=>navigate("/messages")}/>}
      {modal==="editProfile"&&<EditProfileModal judge={judge} onClose={()=>setModal(null)} onSave={editProfile}/>}
    </>
  );
}

// ── Start Conversation Modal ───────────────────────────────────────────────────
function StartConvModal({judge, user, onClose, onCreated}) {
  const [text,setText]=useState("");
  const [sending,setSending]=useState(false);
  const [err,setErr]=useState("");

  const send=async()=>{
    if(!text.trim()){setErr("Please write a message.");return;}
    setSending(true); setErr("");
    try {
      const {db}=await import("./firebase");
      const {doc,setDoc,collection,addDoc}=await import("firebase/firestore");
      const cid=`${judge.id}__${user.uid}`;
      const now=new Date().toISOString();
      await setDoc(doc(db,"conversations",cid),{
        judgeId:judge.id, judgeName:judge.name, judgeSlug:judge.slug||judge.id,
        senderUid:user.uid, senderName:user.name, senderPhoto:user.photo||null,
        lastMessage:text.trim(), lastMessageAt:now, lastMessageBy:"sender",
        unreadForJudge:1, unreadForSender:0, createdAt:now,
      },{merge:true});
      await addDoc(collection(db,"conversations",cid,"messages"),{
        from:"sender", fromName:user.name, fromUid:user.uid,
        text:text.trim(), sentAt:now,
      });
      onCreated(cid);
      onClose();
    } catch(e){console.error(e);setErr("Failed to send — please try again.");}
    setSending(false);
  };

  return (
    <Modal onClose={onClose} title={`Message ${judge.name}`} subtitle="They'll be notified and can reply from their inbox">
      <Field label="Your message" multiline rows={5} value={text}
        onChange={e=>setText(e.target.value)}
        placeholder={`Write your message to ${judge.name}…`}
        style={{marginBottom:16}}/>
      {err&&<div style={{padding:"10px 14px",background:T.redLight,borderRadius:T.rsm,fontSize:13,color:T.red,marginBottom:14}}>{err}</div>}
      <Btn fullWidth onClick={send} disabled={sending}>{sending?"Sending…":"Send message"}</Btn>
    </Modal>
  );
}

// ── Messages Route ─────────────────────────────────────────────────────────────
function MessagesRoute({user}) {
  const navigate=useNavigate();
  const location=useLocation();
  const [convs,setConvs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [activeId,setActiveId]=useState(location.state?.activeConvId||null);
  const [msgs,setMsgs]=useState([]);
  const [msgsLoading,setMsgsLoading]=useState(false);
  const [replyText,setReplyText]=useState("");
  const [sending,setSending]=useState(false);
  const [isMobile,setIsMobile]=useState(window.innerWidth<768);
  const bottomRef=useRef(null);

  const isJudge=user?.role==="judge"&&!!user?.judgeId;

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);

  // Real-time conversation list
  useEffect(()=>{
    if(!user) return;
    let unsub;
    (async()=>{
      try {
        const {db}=await import("./firebase");
        const {collection,query,where,onSnapshot}=await import("firebase/firestore");
        const q=isJudge
          ? query(collection(db,"conversations"),where("judgeId","==",user.judgeId))
          : query(collection(db,"conversations"),where("senderUid","==",user.uid));
        unsub=onSnapshot(q,snap=>{
          setConvs(snap.docs.map(d=>({id:d.id,...d.data()}))
            .sort((a,b)=>(b.lastMessageAt||"").localeCompare(a.lastMessageAt||"")));
          setLoading(false);
        },e=>{console.error(e);setLoading(false);});
      } catch(e){console.error(e);setLoading(false);}
    })();
    return()=>{if(unsub)unsub();};
  },[user]);

  // Real-time messages for active conversation
  useEffect(()=>{
    if(!activeId){setMsgs([]);return;}
    setMsgsLoading(true); setMsgs([]);
    let unsub;
    (async()=>{
      try {
        const {db}=await import("./firebase");
        const {collection,query,orderBy,onSnapshot}=await import("firebase/firestore");
        unsub=onSnapshot(
          query(collection(db,"conversations",activeId,"messages"),orderBy("sentAt","asc")),
          snap=>{setMsgs(snap.docs.map(d=>({id:d.id,...d.data()})));setMsgsLoading(false);},
          e=>{console.error(e);setMsgsLoading(false);}
        );
      } catch(e){console.error(e);setMsgsLoading(false);}
    })();
    return()=>{if(unsub)unsub();};
  },[activeId]);

  // Mark as read on open
  useEffect(()=>{
    if(!activeId||!user) return;
    const conv=convs.find(c=>c.id===activeId);
    if(!conv) return;
    const field=isJudge?"unreadForJudge":"unreadForSender";
    if(!conv[field]) return;
    (async()=>{
      try {
        const {db}=await import("./firebase");
        const {doc,updateDoc}=await import("firebase/firestore");
        await updateDoc(doc(db,"conversations",activeId),{[field]:0});
      } catch(e){}
    })();
  },[activeId,convs]);

  // Scroll to bottom on new messages
  useEffect(()=>{
    if(msgs.length) bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[msgs]);

  const send=async()=>{
    if(!replyText.trim()||!activeId||sending) return;
    const text=replyText.trim();
    setReplyText("");
    setSending(true);
    try {
      const {db}=await import("./firebase");
      const {doc,updateDoc,collection,addDoc}=await import("firebase/firestore");
      const now=new Date().toISOString();
      const side=isJudge?"judge":"sender";
      const otherField=isJudge?"unreadForSender":"unreadForJudge";
      const conv=convs.find(c=>c.id===activeId);
      await addDoc(collection(db,"conversations",activeId,"messages"),{
        from:side, fromName:user.name, fromUid:user.uid, text, sentAt:now,
      });
      await updateDoc(doc(db,"conversations",activeId),{
        lastMessage:text, lastMessageAt:now, lastMessageBy:side,
        [otherField]:(conv?.[otherField]||0)+1,
      });
    } catch(e){console.error(e);setReplyText(text);}
    setSending(false);
  };

  if(!user) return <Navigate to="/"/>;

  const activeConv=convs.find(c=>c.id===activeId);
  const myUnread=c=>isJudge?(c.unreadForJudge||0):(c.unreadForSender||0);
  const otherName=c=>isJudge?c.senderName:c.judgeName;
  const otherPhoto=c=>isJudge?(c.senderPhoto||null):null;
  const showList=!isMobile||!activeId;
  const showThread=!isMobile||!!activeId;

  return (
    <div style={{height:"calc(100vh - 64px)",display:"flex",flexDirection:"column",background:T.bg}}>
      {/* Header */}
      <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"0 20px",display:"flex",alignItems:"center",gap:8,height:52,flexShrink:0}}>
        {isMobile&&activeId?(
          <button onClick={()=>setActiveId(null)}
            style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14,fontWeight:500,padding:"6px 10px",borderRadius:100,fontFamily:"inherit"}}>
            ← Back
          </button>
        ):(
          <button onClick={()=>navigate(-1)}
            style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14,fontWeight:500,padding:"6px 10px",borderRadius:100,fontFamily:"inherit"}}>
            ← Back
          </button>
        )}
        <span style={{fontSize:15,fontWeight:500,color:T.text}}>
          {isMobile&&activeConv?otherName(activeConv):"Messages"}
        </span>
      </div>

      {/* Body */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Conversation list */}
        {showList&&(
          <div style={{width:isMobile?"100%":300,flexShrink:0,borderRight:isMobile?"none":`1px solid ${T.border}`,overflowY:"auto"}}>
            {loading?(
              <div style={{padding:40,textAlign:"center",color:T.textHint,fontSize:13}}>Loading…</div>
            ):convs.length===0?(
              <div style={{padding:"60px 24px",textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:12}}>✉</div>
                <p style={{margin:"0 0 6px",fontSize:14,color:T.textSub,fontWeight:500}}>No conversations yet</p>
                <p style={{margin:0,fontSize:13,color:T.textHint}}>
                  {isJudge?"Exhibitors who contact you through your profile will appear here.":"Visit a judge's profile and click Contact to start a conversation."}
                </p>
              </div>
            ):convs.map(c=>{
              const unread=myUnread(c);
              const name=otherName(c);
              const photo=otherPhoto(c);
              return (
                <div key={c.id} onClick={()=>setActiveId(c.id)}
                  style={{padding:"14px 16px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,
                    background:activeId===c.id?T.accentLight:"transparent",
                    borderLeft:`3px solid ${activeId===c.id?T.accent:"transparent"}`,
                    transition:"background .15s"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    {photo
                      ?<img src={photo} style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
                      :<Avatar label={initials(name||"?")} size={36}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontWeight:unread>0?600:400,fontSize:14,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
                          {unread>0&&<span style={{width:7,height:7,borderRadius:"50%",background:T.accent,flexShrink:0,display:"inline-block"}}/>}
                          {name}
                        </span>
                        <span style={{fontSize:11,color:T.textHint,flexShrink:0}}>{fmtDate(c.lastMessageAt)}</span>
                      </div>
                      <p style={{margin:0,fontSize:12,color:T.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {c.lastMessageBy===(isJudge?"judge":"sender")?"You: ":""}{c.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Thread */}
        {showThread&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {!activeId?(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,color:T.textHint}}>
                <div style={{fontSize:48,opacity:.35}}>💬</div>
                <p style={{margin:0,fontSize:14,color:T.textSub}}>Select a conversation</p>
              </div>
            ):(
              <>
                {/* Thread header */}
                {!isMobile&&activeConv&&(
                  <div style={{padding:"12px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
                    {otherPhoto(activeConv)
                      ?<img src={otherPhoto(activeConv)} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}} alt=""/>
                      :<Avatar label={initials(otherName(activeConv)||"?")} size={30}/>}
                    <span style={{fontSize:15,fontWeight:500,color:T.text}}>{otherName(activeConv)}</span>
                  </div>
                )}
                {/* Messages */}
                <div style={{flex:1,overflowY:"auto",padding:"20px 20px 8px",display:"flex",flexDirection:"column",gap:2}}>
                  {msgsLoading?(
                    <div style={{textAlign:"center",color:T.textHint,fontSize:13,padding:20}}>Loading…</div>
                  ):msgs.map(m=>{
                    const mine=m.fromUid===user.uid;
                    return (
                      <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:mine?"flex-end":"flex-start",marginBottom:8}}>
                        {!mine&&<span style={{fontSize:11,color:T.textHint,marginBottom:3,paddingLeft:2}}>{m.fromName}</span>}
                        <div style={{
                          maxWidth:"70%",padding:"10px 14px",
                          borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                          background:mine?T.accent:T.surface,
                          color:mine?"#fff":T.text,
                          fontSize:14,lineHeight:1.6,boxShadow:T.shadow,
                        }}>{m.text}</div>
                        <span style={{fontSize:11,color:T.textHint,marginTop:3}}>{fmtDate(m.sentAt)}</span>
                      </div>
                    );
                  })}
                  <div ref={bottomRef}/>
                </div>
                {/* Reply input */}
                <div style={{padding:"10px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"flex-end",flexShrink:0,background:T.bg}}>
                  <textarea value={replyText} onChange={e=>setReplyText(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                    placeholder="Type a message… Enter to send, Shift+Enter for new line"
                    rows={2}
                    style={{flex:1,padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontSize:14,fontFamily:"inherit",resize:"none",outline:"none",color:T.text,background:T.bg,lineHeight:1.5}}
                    onFocus={e=>e.target.style.borderColor=T.accent}
                    onBlur={e=>e.target.style.borderColor=T.border}/>
                  <button onClick={send} disabled={sending||!replyText.trim()}
                    style={{padding:"10px 18px",borderRadius:100,background:T.accent,color:"#fff",border:"none",
                      cursor:sending||!replyText.trim()?"not-allowed":"pointer",
                      fontSize:14,fontWeight:500,fontFamily:"inherit",
                      opacity:sending||!replyText.trim()?0.5:1,flexShrink:0,transition:"opacity .15s"}}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Judge Dashboard ────────────────────────────────────────────────────────────
function JudgeDashboard({user, judge, reviews, unreadMsgCount, onEditProfile, onNavigate}) {
  const navigate = useNavigate();
  const myReviews = reviews.filter(r=>r.judgeId===judge?.id)
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  const overallAvg = judge && myReviews.length
    ? (myReviews.reduce((s,r)=>s+(r.overall||0),0)/myReviews.length).toFixed(1)
    : null;

  const Card = ({children, style:s}) => (
    <div style={{background:T.surface,borderRadius:T.r,padding:"20px 22px",border:`1px solid ${T.border}`,...s}}>
      {children}
    </div>
  );

  const SectionHd = ({children, action}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <span style={{fontSize:11,fontWeight:700,color:T.textHint,textTransform:"uppercase",letterSpacing:1}}>{children}</span>
      {action}
    </div>
  );

  return (
    <div style={{maxWidth:900,margin:"0 auto",padding:"36px 20px"}}>
      {/* Welcome */}
      <div style={{marginBottom:28}}>
        <h1 style={{margin:"0 0 4px",fontSize:28,fontWeight:400,color:T.text,letterSpacing:-0.5}}>
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p style={{margin:0,fontSize:14,color:T.textSub}}>Here's your judge.dog overview</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

        {/* Profile card */}
        <Card>
          <SectionHd action={
            <button onClick={onEditProfile}
              style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0,fontFamily:"inherit"}}>
              Edit profile
            </button>
          }>My profile</SectionHd>
          {judge ? (
            <>
              <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
                <Avatar label={judge.photo} photoUrl={judge.profilePhoto} size={52}/>
                <div>
                  <div style={{fontSize:16,fontWeight:500,color:T.text,marginBottom:2}}>{judge.name}</div>
                  {judge.headline&&<div style={{fontSize:13,color:T.textSub,fontStyle:"italic"}}>{judge.headline}</div>}
                  {!judge.headline&&<div style={{fontSize:13,color:T.textHint,fontStyle:"italic"}}>No headline yet</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:16,marginBottom:16}}>
                {overallAvg&&<div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:500,color:T.text}}>{overallAvg}</div>
                  <div style={{fontSize:11,color:T.textHint}}>avg rating</div>
                </div>}
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:500,color:T.text}}>{myReviews.length}</div>
                  <div style={{fontSize:11,color:T.textHint}}>reviews</div>
                </div>
                {judge.galleryPhotos?.length>0&&<div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:500,color:T.text}}>{judge.galleryPhotos.length}</div>
                  <div style={{fontSize:11,color:T.textHint}}>gallery photos</div>
                </div>}
              </div>
              <Btn small onClick={()=>navigate(`/judge/${judge.slug||judge.id}`)}>View my profile</Btn>
            </>
          ):(
            <p style={{fontSize:13,color:T.textHint,margin:0}}>Profile not found — contact support.</p>
          )}
        </Card>

        {/* Messages card */}
        <Card style={{cursor:"pointer"}} onClick={()=>navigate("/messages")}>
          <SectionHd action={
            <span style={{fontSize:12,color:T.accent,fontWeight:500}}>View all →</span>
          }>Messages</SectionHd>
          {unreadMsgCount>0?(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:28,fontWeight:300,color:T.accent}}>{unreadMsgCount}</span>
              <span style={{fontSize:13,color:T.textSub}}>unread message{unreadMsgCount!==1?"s":""}</span>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:28,fontWeight:300,color:T.textHint}}>0</span>
              <span style={{fontSize:13,color:T.textHint}}>unread messages</span>
            </div>
          )}
          <div style={{fontSize:13,color:T.textSub,lineHeight:1.6}}>
            Exhibitors and organizers can contact you through your profile page.
          </div>
        </Card>
      </div>

      {/* Recent reviews */}
      {myReviews.length>0&&(
        <Card>
          <SectionHd action={
            <button onClick={()=>navigate(`/judge/${judge?.slug||judge?.id}`)}
              style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0,fontFamily:"inherit"}}>
              See all →
            </button>
          }>Recent reviews</SectionHd>
          {myReviews.map((r,i)=>(
            <div key={r.id} style={{padding:"12px 0",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div>
                  <span style={{fontSize:14,fontWeight:500,color:T.text}}>{r.userName}</span>
                  <span style={{fontSize:12,color:T.textHint,marginLeft:10}}>{r.breed} · {r.show}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <Stars val={r.overall} size={12}/>
                  <span style={{fontSize:12,color:T.textHint}}>{fmtDate(r.date)}</span>
                </div>
              </div>
              <p style={{margin:0,fontSize:13,color:T.textSub,lineHeight:1.6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                {r.text}
              </p>
            </div>
          ))}
        </Card>
      )}

      {myReviews.length===0&&(
        <Card style={{textAlign:"center",padding:"40px 22px"}}>
          <div style={{fontSize:36,marginBottom:12}}>★</div>
          <p style={{margin:"0 0 6px",fontSize:15,color:T.text,fontWeight:500}}>No reviews yet</p>
          <p style={{margin:0,fontSize:13,color:T.textHint}}>Share your profile link so exhibitors can leave reviews after shows.</p>
        </Card>
      )}
    </div>
  );
}

// ── Admin Route ────────────────────────────────────────────────────────────────
function AdminRoute({judges,reviews,bookings,user,patchJudge,saveJudges,saveReviews}) {
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
      onVerifyJudge={async(claim,approve)=>{
        const {db}=await import("./firebase");
        const {doc,updateDoc,collection,query,where,getDocs}=await import("firebase/firestore");
        await updateDoc(doc(db,"claims",claim.id),{status:approve?"approved":"rejected"});
        if(approve){
          await updateDoc(doc(db,"judges",claim.judgeId),{verified:true,claimedBy:claim.userEmail});
          patchJudge(claim.judgeId,{verified:true,claimedBy:claim.userEmail});
          // Update user role — doc ID is the user's uid
          await updateDoc(doc(db,"users",claim.userId),{role:"judge",judgeId:claim.judgeId});
          // Auto-reject any other pending claims for the same judge
          const otherClaims=await getDocs(query(collection(db,"claims"),where("judgeId","==",claim.judgeId)));
          await Promise.all(otherClaims.docs
            .filter(d=>d.id!==claim.id&&d.data().status==="pending")
            .map(d=>updateDoc(d.ref,{status:"rejected"}))
          );
        }
      }}
    />
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [judges,setJudges]=useState([]); const [reviews,setReviews]=useState([]);
  const [bookings,setBookings]=useState([]); const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true); const [modal,setModal]=useState(null);
  const [unreadMsgCount,setUnreadMsgCount]=useState(0);
  const [search,setSearch]=useState(""); const [sort,setSort]=useState("name"); const [orgFilter,setOrgFilter]=useState("all");
  const [isMobile,setIsMobile]=useState(window.innerWidth<640);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const navigate=useNavigate();
  const location=useLocation();

  useEffect(()=>{
    (async()=>{
      try {
        const {db} = await import("./firebase");
        const {collection, getDocs} = await import("firebase/firestore");
        const snap = await getDocs(collection(db,"judges"));
        const firestoreJudges = snap.docs.map(d=>({...d.data(),id:d.id}));
        setJudges(firestoreJudges);
      } catch(e) {
        console.error("Failed to load judges from Firestore:", e);
        const sj = await sGet(K.judges,SEED_JUDGES);
        setJudges(sj);
      }
      const sr=await sGet(K.reviews,null);
      const sb=await sGet(K.bookings,null);
      if(!sr){await sSet(K.reviews,[]);setReviews([]);}else setReviews(sr);
      if(!sb){await sSet(K.bookings,[]);setBookings([]);}else setBookings(sb);
      setLoading(false);
    })();
    const unsub = onAuthChange(u=>setUser(u));
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<640);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);

  useEffect(()=>{ setMobileMenuOpen(false); },[location.pathname]);

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

  const saveJudges=async jj=>{
    setJudges(jj);
    try {
      const {db} = await import("./firebase");
      const {doc,setDoc} = await import("firebase/firestore");
      for(const j of jj) await setDoc(doc(db,"judges",j.id),j);
    } catch(e){ console.error("Failed to save judges:", e); }
  };
  const saveReviews=async rr=>{setReviews(rr);await sSet(K.reviews,rr);};
  const saveBookings=async bb=>{setBookings(bb);await sSet(K.bookings,bb);};
  const addReview=useCallback(async r=>{const u=[...reviews,r];await saveReviews(u);},[reviews]);
  const addBooking=useCallback(async b=>{const u=[...bookings,b];await saveBookings(u);},[bookings]);

  const claimJudge=useCallback(async(judgeId)=>{
    if(!judgeId||!user) return;
    await saveJudges(judges.map(j=>j.id===judgeId?{...j,verified:true,claimedBy:user.email}:j));
    const {db}=await import("./firebase");
    const {doc,updateDoc}=await import("firebase/firestore");
    await updateDoc(doc(db,"users",user.uid),{role:"judge",judgeId});
    setUser(u=>({...u,role:"judge",judgeId}));
  },[judges,user]);

  const editProfile=useCallback(async upd=>{
    setJudges(jj=>jj.map(j=>j.id===upd.id?upd:j));
    const {db}=await import("./firebase");
    const {doc,setDoc}=await import("firebase/firestore");
    await setDoc(doc(db,"judges",upd.id),upd);
  },[]);

  const saveReply=useCallback(async(rid,text)=>{
    await saveReviews(reviews.map(r=>r.id===rid?{...r,reply:text}:r));
  },[reviews]);

  const logout=async()=>{await firebaseSignOut();setUser(null);};

  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim();
    const visible=judges.filter(j=>!j.hidden);
    if(!q) return visible;
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
      return mQ&&mO;
    }).sort((a,b)=>{
      if(sort==="name") return a.name.localeCompare(b.name);
      const ra=reviews.filter(r=>r.judgeId===a.id),rb=reviews.filter(r=>r.judgeId===b.id);
      if(sort==="rating") return avg(rb.map(r=>r.overall||0))-avg(ra.map(r=>r.overall||0));
      if(sort==="reviews") return rb.length-ra.length;
      return 0;
    });
  },[judges,reviews,search,orgFilter,sort]);

  if(loading) return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:T.textHint}}>Loading…</div>;

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

      {/* Nav */}
      <nav style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:isMobile?"0 12px":"0 20px",display:"flex",alignItems:"center",gap:isMobile?8:0,justifyContent:"space-between",height:64,position:"sticky",top:0,zIndex:200}}>
        {/* Brand */}
        <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0}} onClick={()=>navigate("/")}>
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

        {/* Desktop: centered search */}
        {!isMobile&&(
          <div style={{position:"absolute",left:0,right:0,display:"flex",justifyContent:"center",pointerEvents:"none"}}>
            <div style={{width:480,maxWidth:"calc(100vw - 340px)",position:"relative",pointerEvents:"all"}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.textHint,pointerEvents:"none",lineHeight:1}}>🔍</span>
              <input value={search} onChange={e=>{setSearch(e.target.value);navigate("/");}}
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
            {user?(
              <>
                <button onClick={()=>navigate("/messages")} title="Messages"
                  style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:"6px 10px",borderRadius:100,color:T.textSub,fontSize:22,display:"flex",alignItems:"center",lineHeight:1}}>
                  ✉
                  {unreadMsgCount>0&&<span style={{position:"absolute",top:2,right:4,width:16,height:16,background:T.red,borderRadius:"50%",fontSize:10,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{unreadMsgCount}</span>}
                </button>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px 5px 6px",borderRadius:100,background:T.surface,border:`1px solid ${T.border}`}}>
                  {user.photo
                    ?<img src={user.photo} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover"}} alt=""/>
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
                <div style={{display:"flex",alignItems:"center",gap:12,paddingBottom:12,borderBottom:`1px solid ${T.border}`,marginBottom:12}}>
                  {user.photo
                    ?<img src={user.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
                    :<Avatar label={initials(user.name)} size={38}/>}
                  <div style={{minWidth:0}}>
                    <p style={{margin:0,fontSize:15,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</p>
                    <p style={{margin:0,fontSize:12,color:T.textHint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</p>
                  </div>
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
          </div>
        </>
      )}

      <Routes>
        <Route path="/" element={user?.role==="judge" && !search.trim()
          ? <JudgeDashboard
              user={user}
              judge={judges.find(j=>j.id===user.judgeId)}
              reviews={reviews}
              unreadMsgCount={unreadMsgCount}
              onEditProfile={()=>navigate(`/judge/${judges.find(j=>j.id===user.judgeId)?.slug||user.judgeId}`)}
            />
          : (
          <div style={{maxWidth:1040,margin:"0 auto",padding:"44px 20px"}}>
            <div style={{textAlign:"center",marginBottom:44}}>
              <h1 style={{fontSize:42,fontWeight:300,color:T.text,margin:"0 0 14px",letterSpacing:-1.2,lineHeight:1.15,fontFamily:"'Google Sans',sans-serif"}}>
                Know your judge<br/><span style={{fontWeight:500}}>before you enter.</span>
              </h1>
              <p style={{color:T.textSub,fontSize:16,maxWidth:420,margin:"0 auto",lineHeight:1.6,fontWeight:300}}>
                Real reviews from exhibitors worldwide. Verified judge profiles across FCI, AKC, KC and more.
              </p>
            </div>

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
                {filtered.map(j=><JudgeCard key={j.id} judge={j} reviews={reviews} onClick={()=>navigate("/judge/"+(j.slug||j.id))}/>)}
              </div>
            )}
          </div>
          )}/>
        <Route path="/judge/:slug" element={
          <JudgeRoute judges={judges} reviews={reviews} user={user}
            addReview={addReview} addBooking={addBooking}
            claimJudge={claimJudge} editProfile={editProfile} saveReply={saveReply}
            onRequestAuth={()=>setModal("auth")}/>
        }/>
        <Route path="/messages" element={<MessagesRoute user={user}/>}/>
        <Route path="/admin" element={
          <AdminRoute judges={judges} reviews={reviews} bookings={bookings} user={user}
            patchJudge={(id,updates)=>setJudges(jj=>jj.map(j=>j.id===id?{...j,...updates}:j))}
            saveJudges={saveJudges} saveReviews={saveReviews}/>
        }/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>

      {modal==="auth"&&<AuthModal onClose={()=>setModal(null)} onAuth={u=>{setUser(u);setModal(null);}}/>}
    </>
  );
}
