// One-off analysis script — reads live Firestore events and flags real scheduling issues:
// 1) same person appearing in two time-overlapping events (double-booked)
// 2) same person in back-to-back events with zero buffer (tight handoff)
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

async function main() {
  const snap = await db.collection("events").get();
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  events.sort((a, b) => toMin(a.start) - toMin(b.start));

  console.log(`Loaded ${events.length} events.\n`);

  const overlaps = [];
  const tight = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      const aStart = toMin(a.start), aEnd = toMin(a.end);
      const bStart = toMin(b.start), bEnd = toMin(b.end);
      const doOverlap = aStart < bEnd && bStart < aEnd;
      const gap = bStart - aEnd; // only meaningful if a ends before/at b starts, same-ish order
      const sharedPoc = (a.poc || []).filter((p) => (b.poc || []).includes(p));

      if (doOverlap && sharedPoc.length) {
        overlaps.push({ a, b, sharedPoc });
      } else if (!doOverlap && gap >= 0 && gap <= 5 && sharedPoc.length && aEnd <= bStart) {
        tight.push({ a, b, sharedPoc, gap });
      }
    }
  }

  console.log("=== DOUBLE-BOOKED (same person, overlapping time) ===");
  if (!overlaps.length) console.log("None found.");
  overlaps.forEach(({ a, b, sharedPoc }) => {
    console.log(`- ${sharedPoc.join(", ")}: "${a.title}" (${a.start}-${a.end}) OVERLAPS "${b.title}" (${b.start}-${b.end})`);
  });

  console.log("\n=== TIGHT HANDOFFS (same person, <=5 min or zero buffer between) ===");
  if (!tight.length) console.log("None found.");
  tight.forEach(({ a, b, sharedPoc, gap }) => {
    console.log(`- ${sharedPoc.join(", ")}: "${a.title}" ends ${a.end} -> "${b.title}" starts ${b.start} (gap ${gap}min)`);
  });

  console.log("\n=== ALL EVENTS WITH NO PERSON-IN-CHARGE LISTED ===");
  events.filter((e) => !(e.poc && e.poc.length)).forEach((e) => {
    console.log(`- ${e.start}-${e.end} "${e.title}"`);
  });

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
