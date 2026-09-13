// Static reference data — 20 Sept 2026
// The live, editable day-of timeline lives in Firestore (collection "events"),
// seeded once from seed/seed-data.js. This file only holds data that stays fixed.
export const WEDDING_DATE = "2026-09-20";

export const POCS = [
  { section: "Logistics", role: "Main POC for bride and groom — facilitate conversations, safekeep & ensure Groom & Bride packlist is accounted for",
    bridesmaid: ["Shuyin", "Justine"], groomsmen: ["Junle", "Clarence"] },
  { section: "Photo-taking", role: "Bridal party photoshoot at Fullerton Hotel before Solemnisation (grooms & groomsmen, bride & bridesmaid, with family)",
    bridesmaid: ["Shuyin", "Xinxuan"], groomsmen: ["Yao Leyang"] },
  { section: "Solemnisation", role: "Manage decoration & flow — floral table set up by Mirage Florist before 5:30 PM, liaise with Solemniser Mr Dragonic Lee, march-in music (3.5mm audio jack)",
    bridesmaid: ["Xinxuan", "Jieyi"], groomsmen: ["Aaron"] },
  { section: "Reception", role: "Reception table setup & guest seating, registration table (open before 6:30 PM), parking coupons, wishing cards/lucky draw, 2 laptops needed, safekeep 2 angbao boxes, coordinate with banquet manager on seating changes",
    bridesmaid: ["Weiqing", "Jieyi", "Jingyang (bride's brother)"], groomsmen: ["Tan Jun Hong", "Wu Yueze"] },
  { section: "Reception", role: "Coordinate reception area vendors — setup/teardown timing, wifi/water/socket points, crowd control, grabfood dinner for vendors (Musical Touch dinner 6 PM)",
    bridesmaid: ["Xinli", "MingFeng"], groomsmen: ["Ryan Jee", "Zhang Yuntong"] },
  { section: "Ballroom", role: "Coordinate ballroom vendors, full program flow with emcee (QiaoHan), cue couple for march-ins, coordinate photographers for post-march-in photos",
    bridesmaid: ["Justine"], groomsmen: ["Junle", "Clarence", "Aaron"] },
  { section: "AV", role: "Play videos, music etc.",
    bridesmaid: [], groomsmen: ["Yao Leyang", "Tan Jun Hong"] },
];

export const VENDORS = [
  { section: "Morning Preparations", role: "Photographer & Videographer", company: "Depair", contact: "Pauline", phone: "+65 8685 6895", timing: "7:15 AM (bride side), 7:30 AM (groom side)" },
  { section: "Morning Preparations", role: "Makeup Artist", company: "Autelier Imelda", contact: "Imelda / Jessica", phone: "+65 8186 4688 / +65 8893 3389", timing: "5:00 AM" },
  { section: "Morning Preparations", role: "Car Rental", company: "", contact: "", phone: "", timing: "" },
  { section: "Solemnisation", role: "Solemniser", company: "Mr Lee (Kee Siang Lee)", contact: "Mr Lee", phone: "+65 9663 6334", timing: "5:45 PM" },
  { section: "Solemnisation", role: "Florist", company: "Mirage Florist", contact: "Priscilla Lim", phone: "+65 8588 8769", timing: "" },
  { section: "Banquet", role: "Photographer & Videographer", company: "Depair", contact: "Pauline", phone: "+65 8685 6895", timing: "" },
  { section: "Banquet", role: "Wedding Venue Deco", company: "Victoria Wedding", contact: "Scarlet / Shawn", phone: "+65 8088 2242 / +65 9159 3670", timing: "4:00 PM (setup done by 5:30-5:45 PM)" },
  { section: "Banquet", role: "Banquet Manager", company: "Fullerton Hotel Singapore", contact: "Zahera (for now)", phone: "", timing: "" },
  { section: "Banquet", role: "Makeup Artist", company: "Autelier Imelda", contact: "Imelda / Jessica", phone: "+65 8186 4688 / +65 8893 3389", timing: "5:30 AM (bride's house), 2 PM (Fullerton hotel)" },
  { section: "Banquet", role: "Wedding Band & Emcee", company: "Musical Touch", contact: "Julian", phone: "+65 8770 8649", timing: "6 PM, teardown 11 PM" },
  { section: "Banquet", role: "Photobooth & Telebooth", company: "1010Media", contact: "Alistair", phone: "+65 9668 1500", timing: "" },
  { section: "Banquet", role: "Ice Cream Live Station", company: "Birds of Paradise", contact: "", phone: "", timing: "" },
  { section: "Logistics", role: "Safekeep & ensure Groom & Bride packlist accounted for", company: "Groomsmen & Bridesmaid", contact: "", phone: "", timing: "", picInCharge: "Shuyin" },
  { section: "Logistics", role: "Reception table", company: "Groomsmen & Bridesmaid", contact: "", phone: "", timing: "", picInCharge: "Weiqing, Xinxuan, Chiaqing" },
];

// ---------- role lookup (for role filtering + tappable contacts) ----------
function stripAnnotation(name) {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

export const BRIDESMAID_NAMES = new Set();
export const GROOMSMEN_NAMES = new Set();
POCS.forEach((p) => {
  p.bridesmaid.forEach((n) => BRIDESMAID_NAMES.add(stripAnnotation(n)));
  p.groomsmen.forEach((n) => GROOMSMEN_NAMES.add(stripAnnotation(n)));
});

export const VENDOR_NAMES = new Set();
VENDORS.forEach((v) => {
  if (v.company) VENDOR_NAMES.add(v.company);
  if (v.contact) v.contact.split("/").forEach((n) => VENDOR_NAMES.add(n.trim()));
});

export function roleTagsForPoc(poc) {
  const tags = new Set();
  (poc || []).forEach((raw) => {
    const n = stripAnnotation(raw);
    if (BRIDESMAID_NAMES.has(n)) tags.add("bridesmaid");
    if (GROOMSMEN_NAMES.has(n)) tags.add("groomsmen");
    if (VENDOR_NAMES.has(n)) tags.add("vendor");
  });
  return tags;
}

// Returns a phone number if `name` matches a vendor contact/company, else null.
export function findVendorPhone(name) {
  const n = stripAnnotation(name);
  const match = VENDORS.find((v) => v.company === n || (v.contact && v.contact.split("/").map((s) => s.trim()).includes(n)));
  return match?.phone ? match.phone.split("/")[0].trim() : null;
}

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
