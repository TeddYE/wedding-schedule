// Wipes the "events" collection and reseeds it with the new schema
// (section/side/location/deadline/tasks replacing phase/details/remarks).
// Run from seed/: node reseed.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const events = require("./seed-data.js");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function reseed() {
  const col = db.collection("events");
  const existing = await col.get();

  const deleteBatch = db.batch();
  existing.docs.forEach((d) => deleteBatch.delete(d.ref));
  if (!existing.empty) await deleteBatch.commit();
  console.log(`Deleted ${existing.size} old event(s).`);

  const insertBatch = db.batch();
  events.forEach((event, i) => {
    const ref = col.doc();
    insertBatch.set(ref, { ...event, order: i });
  });
  await insertBatch.commit();
  console.log(`Seeded ${events.length} events with the new schema.`);
  process.exit(0);
}

reseed().catch((err) => { console.error(err); process.exit(1); });
