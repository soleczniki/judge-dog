// Per-org discipline options for the search filter.
// Each option has a label (org's native terminology) and
// the disciplineGroups values used to match judges.
// Org selector appears first; this dropdown appears only when a specific org is selected.

export const DISCIPLINE_OPTIONS = {
  FCI: [
    { value: "A", label: "Shows" },
    { value: "B", label: "Field Trials & Hunting" },
    { value: "C", label: "Obedience & Rally" },
    { value: "D", label: "Agility" },
    { value: "E", label: "Tracking & Nose Work" },
    { value: "F", label: "Working & Herding" },
    { value: "G", label: "Grooming" },
    { value: "H", label: "Dog Dancing" },
  ],
  AKC: [
    { value: "A",    label: "Conformation" },
    { value: "C",    label: "Obedience & Rally" },
    { value: "D",    label: "Agility" },
    { value: "E",    label: "Tracking & Scent Work" },
    { value: "B+F",  label: "Performance (Herding, Hunting, Earthdog…)" },
  ],
  // KC, CKC, ANKC, JKC have no discipline data yet — no dropdown shown
};

// Match a judge against a selected discipline value.
// Some values are composite (e.g. "B+F" = either B or F).
export function matchesDiscipline(judge, disciplineValue) {
  if (!disciplineValue || disciplineValue === "all") return true;
  const groups = judge.disciplineGroups || ["A"];
  // Support composite values like "B+F"
  const required = disciplineValue.split("+");
  return required.some(g => groups.includes(g));
}
