export const tc = s => s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : "";

export const isoFromLabel = label => {
  if (!label) return null;
  if (/^[A-Za-z]{2}$/.test(label)) return label.toUpperCase();
  const pts = [...label].map(c => c.codePointAt(0));
  if (pts.length >= 2 && pts[0] >= 0x1F1E6 && pts[0] <= 0x1F1FF)
    return String.fromCharCode(pts[0] - 0x1F1E6 + 65, pts[1] - 0x1F1E6 + 65);
  return null;
};
export const countryISO = j => isoFromLabel(j.flag) || isoFromLabel(j.fciLicenceCountry) || null;

export const avg = a => a.filter(Boolean).length ? a.filter(Boolean).reduce((x,y)=>x+y,0)/a.filter(Boolean).length : 0;
export const uid = () => Math.random().toString(36).slice(2,10);
export const initials = n => n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
export const AVATAR_COLORS = ["#1a73e8","#e53935","#1e8e3e","#f29900","#9334e6","#e52592","#00838f","#e65100"];
export const aColor = s => { let h=0; for(let c of s) h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length; return AVATAR_COLORS[h]; };
export const fmtDate = d => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});

export function toSlug(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const K = { judges:"jyj_v5_judges", reviews:"jyj_v5_reviews", users:"jyj_v5_users", session:"jyj_v5_session", bookings:"jyj_v5_bookings" };
export async function sGet(k,fb){ try{ const r=await window.storage.get(k); return r?JSON.parse(r.value):fb; }catch{ return fb; } }
export async function sSet(k,v){ try{ await window.storage.set(k,JSON.stringify(v)); }catch{} }

export const withTimeout=(promise,ms,msg)=>Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error(msg)),ms))]);

// Helper: get discipline group(s) for a judge (falls back to ["A"])
import { UNIVERSAL_DIMS, GROUP_DIMS } from "./theme.js";
export const judgeGroups = j => (j.disciplineGroups?.length ? j.disciplineGroups : ["A"]);

// Old-format review compatibility: detect if review was written before discipline groups
export const reviewDims = r => {
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
