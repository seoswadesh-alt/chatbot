/**
 * Light typo cleanup only — do not wrap with extra instructions
 * (that breaks roleplay memory/flow).
 */

const REPLACEMENTS = [
  [/\bmujes\b/gi, "mujhe"],
  [/\bmje\b/gi, "mujhe"],
  [/\bkrega\b/gi, "karega"],
  [/\bkregi\b/gi, "karegi"],
  [/\bkrna\b/gi, "karna"],
  [/\bkna\b/gi, "karna"],
  [/\brhi\b/gi, "rahi"],
  [/\brha\b/gi, "raha"],
  [/\bmumy\b/gi, "mummy"],
  [/\bmuumy\b/gi, "mummy"],
  [/\bmumsy\b/gi, "mummy"],
  [/\bluga\b/gi, "lunga"],
  [/\brat\b/gi, "raat"],
  [/\bapki\b/gi, "aapki"],
  [/\bapke\b/gi, "aapke"],
  [/\bapko\b/gi, "aapko"],
  [/\btounge\b/gi, "tongue"],
  [/\btoungue\b/gi, "tongue"],
  [/\bplz\b/gi, "please"],
  // Common RP typos — model should treat as intended word
  [/\bbozer\b/gi, "boxer"],
  [/\bboxers?\b/gi, "boxer"],
  [/\boly\b/gi, "only"],
  [/\bcigrete\b/gi, "cigarette"],
  [/\bcigrate\b/gi, "cigarette"],
  [/\bdhua\b/gi, "dhuan"],
  [/\bphan\s+k(e|ar)\b/gi, "pehan ke"],
  [/\bpehn\b/gi, "pehan"],
  [/\bbejo\b/gi, "bhejo"],
  [/\bgahr\b/gi, "ghar"],
  [/\bsarre\b/gi, "saree"],
  [/\bphanti\b/gi, "pehanti"],
  [/\bfigue\b/gi, "figure"],
  [/\bkraome\b/gi, "chrome"],
  [/\bhandel\b/gi, "handle"],
  [/\balmariha\b/gi, "almari"],
  [/\bkhsuboo\b/gi, "khushboo"],
  [/\bkhsu?boo\b/gi, "khushboo"],
  // Chat slang → intended dirty words (Hinglish RP)
  [/\bland\b/gi, "lund"],
  [/\bgand\b/gi, "gaand"],
];

function normalizeHinglish(text) {
  let out = String(text || "").trim().replace(/\s+/g, " ");
  for (const [pattern, value] of REPLACEMENTS) {
    out = out.replace(pattern, value);
  }
  return out;
}

function prepareUserContent(raw) {
  return normalizeHinglish(raw);
}

module.exports = {
  normalizeHinglish,
  prepareUserContent,
};
