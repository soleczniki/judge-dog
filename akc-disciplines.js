// AKC judge type strings → unified discipline group (A-F)
// Group definitions mirror FCI groups used throughout the codebase:
//   A = Conformation & Shows
//   B = Field Trials & Hunting
//   C = Obedience & Rally
//   D = Agility
//   E = Tracking & Nose Work
//   F = Working & Herding

export const AKC_TYPE_TO_GROUP = {
  // ── A: Conformation & Shows ───────────────────────────────────────────────
  "Conformation":               "A",
  "Best In Show":               "A",
  "Junior Showmanship":         "A",
  "Conformation - Misc Breeds": "A",
  "Sporting Group":             "A",
  "Hound Group":                "A",
  "Working Group":              "A",
  "Terrier Group":              "A",
  "Toy Group":                  "A",
  "Non-Sporting Group":         "A",
  "Herding Group":              "A",
  "Miscellaneous Class":        "A",
  "FSS Open Show":              "A",

  // ── B: Field Trials, Hunting & Earth Sports ───────────────────────────────
  "Field Trial":                "B",
  "Hunting Test":               "B",
  "Earthdog":                   "B",
  "Barn Hunt":                  "B",
  "Fast CAT":                   "B",
  "Lure Coursing":              "B",

  // ── C: Obedience & Rally ──────────────────────────────────────────────────
  "Obedience":                  "C",
  "Rally":                      "C",
  "Rally Obedience":            "C",

  // ── D: Agility ────────────────────────────────────────────────────────────
  "Agility":                    "D",

  // ── E: Tracking & Nose Work ───────────────────────────────────────────────
  "Tracking":                   "E",
  "Tracking Dog Urban":         "E",
  "Tracking Excellent":         "E",
  "Tracking Dog Excellent":     "E",
  "Variable Surface Tracking":  "E",
  "Scent Work":                 "E",

  // ── F: Working, Herding & Other Performance ───────────────────────────────
  "Herding Test":               "F",
  "Herding Trial":              "F",
  "Herding":                    "F",
  "Farm Dog Certification":     "F",
  "Fetch":                      "F",
  "AKC Temperament Test":       "F",
  "Canine Good Citizen":        "F",
};

// Given an array of raw AKC judge type strings, return the unique discipline groups.
// Falls back to ["A"] only if truly nothing matches (conformation judges often just
// have group names like "Sporting Group" which also map to A).
export function akcTypesToGroups(rawTypes = []) {
  const groups = new Set();
  for (const t of rawTypes) {
    const g = AKC_TYPE_TO_GROUP[t];
    if (g) groups.add(g);
  }
  // If we got explicit conformation entries OR group names, that's still group A
  if (groups.size === 0) groups.add("A");
  return Array.from(groups).sort();
}
