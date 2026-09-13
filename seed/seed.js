// Run once to populate Firestore with the initial schedule.
//   1. In Firebase console: Project settings > Service accounts > Generate new private key
//   2. Save the downloaded file as seed/serviceAccountKey.json (already gitignored — never commit it)
//   3. From the seed/ folder: npm install firebase-admin && node seed.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const events = require("./seed-data.js");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seed() {
  const batch = db.batch();
  const col = db.collection("events");

  const existing = await col.get();
  if (!existing.empty) {
    console.log(`Collection "events" already has ${existing.size} document(s).`);
    console.log("Delete them first in the Firebase console if you want to reseed from scratch.");
    process.exit(1);
  }

  events.forEach((event, i) => {
    const ref = col.doc();
    batch.set(ref, { ...event, order: i });
  });

  await batch.commit();
  console.log(`Seeded ${events.length} events into Firestore.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
