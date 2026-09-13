// Consistency check for the schedule data. Runs offline against seed-data.js +
// data.js — no Firestore credentials needed — so it can be run any time the
// schedule is edited:   node seed/verify.js
//
// It catches the failure modes that actually bit this dataset before:
//   1. A POC name that resolves to nobody (renders as a dead, untappable chip)
//   2. A roster member with no duties, or a vendor with no timeline entry
//   3. A clock time written inside a task, which silently drifts from start/end
//   4. Someone double-booked across overlapping events
//   5. Zero-buffer handoffs — informational, but worth eyeballing before the day
const path = require("path");
const events = require("./seed-data.js");

const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const fmt = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

let problems = 0;
const fail = (msg) => { problems++; console.log(`  ✗ ${msg}`); };
const note = (msg) => console.log(`  · ${msg}`);

(async () => {
  const dataUrl = "file://" + path.resolve(__dirname, "../data.js").replace(/\\/g, "/");
  const { PEOPLE, VENDORS, POCS, resolvePersonId, getPerson, SEATING } = await import(dataUrl);

  console.log("\n1. POC names that resolve to nobody");
  const unresolved = new Map();
  events.forEach((e) => (e.poc || []).forEach((t) => {
    if (!resolvePersonId(t)) unresolved.set(t, (unresolved.get(t) || 0) + 1);
  }));
  if (!unresolved.size) note("none — every chip resolves to a person");
  unresolved.forEach((count, t) => fail(`"${t}" (${count}x) is not in PEOPLE`));

  console.log("\n2. Roster members with no duties");
  const assigned = new Set();
  events.forEach((e) => (e.poc || []).forEach((t) => { const id = resolvePersonId(t); if (id) assigned.add(id); }));
  const idle = Object.entries(PEOPLE)
    .filter(([id, p]) => ["bridesmaid", "groomsman"].includes(p.role) && !assigned.has(id));
  if (!idle.length) note("none — every bridesmaid and groomsman has at least one duty");
  idle.forEach(([, p]) => fail(`${p.name} (${p.role}) is on the roster but assigned to nothing`));

  console.log("\n3. Vendors with no timeline entry");
  const orphanVendors = VENDORS.filter((v) => !v.people.some((id) => assigned.has(id)));
  if (!orphanVendors.length) note("none — every vendor appears somewhere on the day");
  orphanVendors.forEach((v) => fail(`${v.company} (${v.service}) has no event`));

  console.log("\n4. Clock times written inside tasks");
  const timeRe = /\b\d{1,2}([:.]\d{2})?\s*(am|pm)\b/i;
  let proseTimes = 0;
  events.forEach((e) => (e.tasks || []).forEach((t) => {
    if (timeRe.test(t)) { fail(`${e.start} "${e.title}" — task contains a time: "${t}"`); proseTimes++; }
  }));
  if (!proseTimes) note("none — times live only in start/end and deadline fields");

  console.log("\n5. Double-booked people (same person, overlapping events)");
  let clashes = 0;
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      if (!(toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end))) continue;
      const bIds = (b.poc || []).map(resolvePersonId).filter(Boolean);
      const shared = (a.poc || []).map(resolvePersonId).filter((id) => id && bIds.includes(id));
      // The couple and generic groups are expected in several places at once.
      const real = shared.filter((id) => !["couple", "group"].includes(PEOPLE[id].role));
      if (!real.length) continue;
      clashes++;
      fail(`${real.map((id) => PEOPLE[id].name).join(", ")} — "${a.title}" (${a.start}-${a.end}) overlaps "${b.title}" (${b.start}-${b.end})`);
    }
  }
  if (!clashes) note("none");

  console.log("\n6. Zero-buffer handoffs (informational)");
  const seen = new Set();
  events.forEach((a) => events.forEach((b) => {
    const gap = toMin(b.start) - toMin(a.end);
    if (gap < 0 || gap > 5) return;
    const bIds = (b.poc || []).map(resolvePersonId).filter(Boolean);
    const shared = (a.poc || []).map(resolvePersonId)
      .filter((id) => id && bIds.includes(id) && !["couple", "group"].includes(PEOPLE[id].role));
    if (!shared.length) return;
    const key = a.title + "|" + b.title;
    if (seen.has(key)) return;
    seen.add(key);
    note(`${shared.map((id) => PEOPLE[id].name).join(", ")} — ${gap} min between "${a.title}" and "${b.title}"`);
  }));

  console.log("\n7. Seating totals");
  const sum = SEATING.tables.reduce((a, t) => a + t.pax, 0);
  if (sum !== SEATING.totalPax) fail(`pax sum ${sum} != declared ${SEATING.totalPax}`);
  if (SEATING.tables.length !== SEATING.totalTables) fail(`table count ${SEATING.tables.length} != declared ${SEATING.totalTables}`);
  if (sum === SEATING.totalPax && SEATING.tables.length === SEATING.totalTables) note(`${SEATING.totalTables} tables, ${sum} pax — consistent`);

  console.log(`\n${problems ? `${problems} problem(s) found.` : "All checks passed."}  ${events.length} events.\n`);
  process.exit(problems ? 1 : 0);
})();
