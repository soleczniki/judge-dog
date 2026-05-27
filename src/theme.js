export const T = {
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

export const ORGS = {
  FCI:  { name: "Fédération Cynologique Internationale", short: "FCI",  color: "#1a73e8" },
  AKC:  { name: "American Kennel Club",                  short: "AKC",  color: "#e53935" },
  KC:   { name: "The Kennel Club (UK)",                  short: "KC",   color: "#1e8e3e" },
  CKC:  { name: "Canadian Kennel Club",                  short: "CKC",  color: "#f29900" },
  ANKC: { name: "Australian National Kennel Council",    short: "ANKC", color: "#9334e6" },
  JKC:  { name: "Japan Kennel Club",                     short: "JKC",  color: "#e52592" },
};

// ── Discipline-based rating system ────────────────────────────────────────────
export const UNIVERSAL_DIMS = [
  {key:"overall",        label:"Overall"},
  {key:"consistency",    label:"Consistency & Fairness"},
  {key:"professionalism",label:"Professionalism"},
];

export const GROUP_DIMS = {
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

export const GROUP_NAMES = {
  A:"Conformation & Shows", B:"Field Trials & Hunting",
  C:"Obedience & Precision Sports", D:"Agility & Speed Sports",
  E:"Nose Work & Tracking", F:"Working & Rescue",
  G:"Grooming", H:"Dog Dancing",
};

export const ENTRY_LABELS = {
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
export const ALL_RATING_KEYS = [...new Set([
  ...UNIVERSAL_DIMS.map(d=>d.key),
  ...Object.values(GROUP_DIMS).flatMap(dims=>dims.map(d=>d.key)),
])];
export const EMPTY_RATINGS = Object.fromEntries(ALL_RATING_KEYS.map(k=>[k,0]));
