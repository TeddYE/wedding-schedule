// Static reference data — 20 Sept 2026
// The live, editable day-of timeline lives in Firestore (collection "events"),
// seeded once from seed/seed-data.js. This file only holds data that stays fixed.
export const WEDDING_DATE = "2026-09-20";

// ---------------------------------------------------------------------------
// PEOPLE — the single source of truth for every human on the day.
//
// Events reference these by *id* (e.g. poc: ["shuyin", "imelda"]), never by
// free text. That is what keeps a chip tappable: a typo in an event used to
// silently produce a dead grey chip with no role colour and no phone number.
//
//   role:    bridesmaid | groomsman | vendor | family | couple | group
//   phone:   primary contact number — makes the chip tap-to-call
//   company: vendor's business name, shown on the contact card
//   note:    anything the bridal party should know before calling
// ---------------------------------------------------------------------------
export const PEOPLE = {
  // ---- bridesmaids ----
  shuyin:    { name: "Shuyin",    role: "bridesmaid" },
  justine:   { name: "Justine",   role: "bridesmaid" },
  xinxuan:   { name: "Xinxuan",   role: "bridesmaid" },
  jieyi:     { name: "Jieyi",     role: "bridesmaid" },
  weiqing:   { name: "Weiqing",   role: "bridesmaid" },
  xinli:     { name: "Xinli",     role: "bridesmaid" },
  mingfeng:  { name: "MingFeng",  role: "bridesmaid" },
  chiaqing:  { name: "Chiaqing",  role: "bridesmaid" },

  // ---- groomsmen ----
  junle:     { name: "Junle",       role: "groomsman" },
  clarence:  { name: "Clarence",    role: "groomsman" },
  aaron:     { name: "Aaron",       role: "groomsman" },
  yaoleyang: { name: "Yao Leyang",  role: "groomsman" },
  junhong:   { name: "Tan Jun Hong", role: "groomsman" },
  yueze:     { name: "Wu Yueze",    role: "groomsman" },
  ryanjee:   { name: "Ryan Jee",    role: "groomsman" },
  yuntong:   { name: "Zhang Yuntong", role: "groomsman" },

  // ---- family & couple ----
  bride:     { name: "Bride",     role: "couple" },
  groom:     { name: "Groom",     role: "couple" },
  jingyang:  { name: "Jingyang",  role: "family", note: "Bride's brother" },
  sheryl:    { name: "Sheryl",    role: "family", note: "Role unconfirmed — please confirm" },
  parents:   { name: "Parents",   role: "group" },
  bmgm:      { name: "Bridesmaids & Groomsmen", role: "group" },

  // ---- vendors ----
  pauline:   { name: "Pauline",       role: "vendor", company: "Depair", phone: "+65 8685 6895", note: "Photographer & videographer" },
  imelda:    { name: "Imelda",        role: "vendor", company: "Autelier Imelda", phone: "+65 8186 4688", note: "Makeup artist" },
  jessica:   { name: "Jessica",       role: "vendor", company: "Autelier Imelda", phone: "+65 8893 3389", note: "Makeup artist" },
  mrlee:     { name: "Mr Lee",        role: "vendor", company: "Kee Siang Lee", phone: "+65 9663 6334", note: "Solemniser" },
  priscilla: { name: "Priscilla Lim", role: "vendor", company: "Mirage Florist", phone: "+65 8588 8769", note: "Florist" },
  scarlet:   { name: "Scarlet",       role: "vendor", company: "Victoria Wedding", phone: "+65 8088 2242", note: "Venue decoration" },
  shawn:     { name: "Shawn",         role: "vendor", company: "Victoria Wedding", phone: "+65 9159 3670", note: "Venue decoration" },
  zahera:    { name: "Zahera",        role: "vendor", company: "Fullerton Hotel Singapore", note: "Banquet manager — number to be confirmed" },
  julian:    { name: "Julian",        role: "vendor", company: "Musical Touch", phone: "+65 8770 8649", note: "Wedding band & sound" },
  qiaohan:   { name: "Qiao Han",      role: "vendor", company: "Musical Touch", note: "Emcee" },
  alistair:  { name: "Alistair",      role: "vendor", company: "1010Media", phone: "+65 9668 1500", note: "Photobooth & telebooth" },
  birds:     { name: "Birds of Paradise", role: "vendor", note: "Ice cream live station" },
};

// Accepts historical / hand-typed spellings so anything still stored in
// Firestore as free text keeps resolving to the right person.
const ALIASES = {
  "yao": "yaoleyang",
  "yao leyang": "yaoleyang",
  "qiaohan": "qiaohan",
  "qiao han": "qiaohan",
  "tan jun hong": "junhong",
  "wu yueze": "yueze",
  "jingyang (bride's brother)": "jingyang",
  "mr lee (kee siang lee)": "mrlee",
  "depair": "pauline",
  "autelier imelda": "imelda",
  "mirage florist": "priscilla",
  "victoria wedding": "scarlet",
  "musical touch": "julian",
  "1010media": "alistair",
  "birds of paradise": "birds",
  "fullerton hotel singapore": "zahera",
  "bridesmaids & groomsmen": "bmgm",
  "photographer": "pauline",
};

const byName = new Map();
Object.entries(PEOPLE).forEach(([id, p]) => byName.set(p.name.toLowerCase(), id));

// Resolve an id, a name, or a known alias to a person id. Returns null when the
// token genuinely isn't a known person, so callers can fall back to a plain label.
export function resolvePersonId(token) {
  if (!token) return null;
  const raw = String(token).trim();
  if (PEOPLE[raw]) return raw;
  const key = raw.toLowerCase();
  if (PEOPLE[key]) return key;
  if (ALIASES[key]) return ALIASES[key];
  if (byName.has(key)) return byName.get(key);
  const stripped = key.replace(/\s*\([^)]*\)/g, "").trim();
  if (ALIASES[stripped]) return ALIASES[stripped];
  if (byName.has(stripped)) return byName.get(stripped);
  return null;
}

// Always returns something renderable. Unknown tokens become an "unknown"
// person so the UI degrades to a plain label instead of breaking.
export function getPerson(token) {
  const id = resolvePersonId(token);
  if (id) return { id, ...PEOPLE[id] };
  return { id: null, name: String(token ?? "").trim(), role: "unknown" };
}

export function personPhone(token) {
  return getPerson(token).phone || null;
}

export function roleTagsForPoc(poc) {
  const tags = new Set();
  (poc || []).forEach((t) => {
    const role = getPerson(t).role;
    if (role && role !== "unknown") tags.add(role);
  });
  return tags;
}

// Every person who has at least one duty, for the "my duties" picker.
export function peopleWithDuties(events) {
  const ids = new Set();
  (events || []).forEach((e) => (e.poc || []).forEach((t) => {
    const id = resolvePersonId(t);
    if (id && ["bridesmaid", "groomsman", "family"].includes(PEOPLE[id].role)) ids.add(id);
  }));
  return [...ids]
    .map((id) => ({ id, ...PEOPLE[id] }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role.localeCompare(b.role)));
}

// ---------------------------------------------------------------------------
// Standing responsibilities — who owns what, independent of any single event.
// `people` holds ids; the app renders them through the same chip pipeline.
// ---------------------------------------------------------------------------
export const POCS = [
  { section: "Logistics",    people: ["shuyin", "justine", "junle", "clarence"],
    role: "Main POC for bride and groom — facilitate conversations, safekeep and account for the groom's and bride's packlists" },
  { section: "Photo-taking", people: ["shuyin", "xinxuan", "yaoleyang"],
    role: "Bridal party photoshoot at Fullerton before solemnisation — couple, bridal party and family" },
  { section: "Solemnisation", people: ["xinxuan", "jieyi", "aaron"],
    role: "Manage decoration and flow — floral table set by Mirage Florist, liaise with the solemniser, march-in music (3.5mm audio jack)" },
  { section: "Reception",    people: ["weiqing", "jieyi", "jingyang", "junhong", "yueze"],
    role: "Reception table setup and guest seating, registration table, parking coupons, wishing cards and lucky draw, 2 laptops, safekeep 2 angbao boxes, coordinate seating changes with the banquet manager" },
  { section: "Reception",    people: ["xinli", "mingfeng", "ryanjee", "yuntong"],
    role: "Coordinate reception-area vendors — setup and teardown timing, wifi/water/socket points, crowd control, vendor dinners" },
  { section: "Ballroom",     people: ["justine", "junle", "clarence", "aaron"],
    role: "Coordinate ballroom vendors, full program flow with the emcee, cue the couple for march-ins, coordinate photographers for post-march-in photos" },
  { section: "AV",           people: ["yaoleyang", "junhong"],
    role: "Play videos, music and montages; own the laptop and audio feed" },
];

// ---------------------------------------------------------------------------
// Vendors — company-level reference. Call times are NOT duplicated here any
// more: every vendor's arrival is a real event on the timeline, so the two can
// no longer drift apart. `people` links to the contacts above.
// ---------------------------------------------------------------------------
export const VENDORS = [
  { company: "Depair",                    service: "Photographer & Videographer", people: ["pauline"] },
  { company: "Autelier Imelda",           service: "Makeup Artist",               people: ["imelda", "jessica"] },
  { company: "Kee Siang Lee",             service: "Solemniser",                  people: ["mrlee"] },
  { company: "Mirage Florist",            service: "Florist",                     people: ["priscilla"] },
  { company: "Victoria Wedding",          service: "Wedding Venue Decoration",    people: ["scarlet", "shawn"] },
  { company: "Fullerton Hotel Singapore", service: "Banquet Manager",             people: ["zahera"] },
  { company: "Musical Touch",             service: "Wedding Band & Emcee",        people: ["julian", "qiaohan"] },
  { company: "1010Media",                 service: "Photobooth & Telebooth",      people: ["alistair"] },
  { company: "Birds of Paradise",         service: "Ice Cream Live Station",      people: ["birds"] },
];

export const SEATING = {
  totalTables: 20,
  totalPax: 185,
  tables: [
    { table: "VIP 1", pax: 10, babyChair: "", special: "" },
    { table: "2", pax: 10, babyChair: "", special: "" },
    { table: "3", pax: 10, babyChair: "", special: "" },
    { table: "4", pax: 9, babyChair: "", special: "3 Halal" },
    { table: "5", pax: 9, babyChair: 1, special: "1 Kid Menu" },
    { table: "6", pax: 10, babyChair: "", special: "" },
    { table: "7", pax: 10, babyChair: 1, special: "1 Kid Menu" },
    { table: "8", pax: 10, babyChair: "", special: "1 No Beef" },
    { table: "9", pax: 10, babyChair: "", special: "1 No Crustaceans" },
    { table: "10", pax: 6, babyChair: "", special: "" },
    { table: "11", pax: 9, babyChair: "", special: "" },
    { table: "12", pax: 10, babyChair: "", special: "" },
    { table: "13", pax: 10, babyChair: "", special: "" },
    { table: "14", pax: 10, babyChair: "", special: "" },
    { table: "15", pax: 8, babyChair: "", special: "" },
    { table: "16", pax: 8, babyChair: "", special: "" },
    { table: "17", pax: 9, babyChair: 1, special: "1 Kid Menu (Halal), 2 Halal, 1 No Crustaceans" },
    { table: "18", pax: 10, babyChair: "", special: "" },
    { table: "19", pax: 7, babyChair: "", special: "" },
    { table: "20", pax: 10, babyChair: "", special: "1 No Veg" },
  ],
};
