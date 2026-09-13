import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";
import { WEDDING_DATE, SEATING, findVendorPhone } from "./data.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

let events = [];
let isEditor = false;
let currentEditId = null;
let hasAutoScrolled = false;

// ---------- helpers ----------
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
function withDate(hhmm) { return new Date(`${WEDDING_DATE}T${hhmm}:00`); }
function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function fmtDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60); const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function sortedEvents() {
  return events.slice().sort((a, b) => (a.start !== b.start ? a.start.localeCompare(b.start) : (a.order ?? 0) - (b.order ?? 0)));
}
function pocChip(name) {
  const phone = findVendorPhone(name);
  return phone
    ? `<button type="button" class="chip tappable" data-action="poc" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
    : `<span class="chip">${escapeHtml(name)}</span>`;
}
function handlePocClick(name) {
  const phone = findVendorPhone(name);
  if (phone) window.location.href = `tel:${phone.replace(/[^+\d]/g, "")}`;
}

// Same-person, near-zero-buffer handoffs — surfaced as a compact note, not a big box.
function computeHandoffWarnings(list) {
  const warnings = new Map();
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const a = list[i], b = list[j];
      const gap = toMin(b.start) - toMin(a.end);
      if (gap < 0 || gap > 5) continue;
      const shared = (a.poc || []).filter((p) => (b.poc || []).includes(p));
      if (!shared.length) continue;
      if (!warnings.has(a.id)) warnings.set(a.id, []);
      warnings.get(a.id).push({ person: shared.join(", "), next: b.title });
    }
  }
  return warnings;
}

// ---------- tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
  });
});

// ---------- now/next bar ----------
function renderNowNextBar() {
  const bar = document.getElementById("nowNextBar");
  const list = sortedEvents();
  if (!list.length) { bar.textContent = "Schedule not loaded yet."; return; }
  const now = new Date();
  const first = withDate(list[0].start);
  const last = list.reduce((max, e) => { const end = withDate(e.end); return end > max ? end : max; }, withDate(list[0].end));

  if (now < first) {
    bar.innerHTML = `<div class="nn-item"><span class="nn-label next">Starts in</span><span class="nn-meta">${fmtDuration(first - now)} — ${escapeHtml(list[0].title)} at ${fmtTime(list[0].start)}</span></div>`;
    return;
  }
  if (now >= last) { bar.innerHTML = `<div class="nn-item"><span class="nn-meta">That's a wrap — congratulations! 🎉</span></div>`; return; }

  const current = list.filter((e) => now >= withDate(e.start) && now < withDate(e.end));
  const next = list.find((e) => withDate(e.start) > now);
  let html = "";
  if (current.length) {
    const c = current[0];
    const meta = [c.location ? `📍 ${escapeHtml(c.location)}` : "", c.poc?.length ? `PIC: ${escapeHtml(c.poc.slice(0, 2).join(", "))}` : "", current.length > 1 ? `+${current.length - 1} more now` : ""].filter(Boolean).join(" · ");
    html += `<div class="nn-item"><span class="nn-label now">Now</span><span class="nn-title">${escapeHtml(c.title)}</span><span class="nn-meta">${meta}</span></div>`;
  }
  if (next) {
    html += `<div class="nn-item"><span class="nn-label next">Next</span><span class="nn-title">${escapeHtml(next.title)}</span><span class="nn-meta">in ${fmtDuration(withDate(next.start) - now)} · ${fmtTime(next.start)}</span></div>`;
  }
  bar.innerHTML = html || "In between activities…";
}

// ---------- event cards ----------
// One detail-rich card per event, colour-coded by side. Everything is visible
// up front: time, location, who's responsible, the deadline and every task.
function sideMeta(side) {
  if (side === "bride") return { cls: "bride", label: "Bride's side" };
  if (side === "groom") return { cls: "groom", label: "Groom's side" };
  return { cls: "everyone", label: "Everyone" };
}

function buildEventCard(ev, now, nextId, handoffWarnings) {
  const isNow = now >= withDate(ev.start) && now < withDate(ev.end);
  const isNext = !isNow && nextId === ev.id;
  const isDone = ev.status === "done";
  const isDelayed = ev.status === "delayed";
  const warn = handoffWarnings.get(ev.id) || [];
  const side = sideMeta(ev.side);

  const badges = [];
  if (isNow) badges.push(`<span class="badge now">Now</span>`);
  if (isNext) badges.push(`<span class="badge next">Next</span>`);
  if (isDone) badges.push(`<span class="badge done">Done</span>`);
  if (isDelayed) badges.push(`<span class="badge delayed">Delayed</span>`);

  return `
    <article class="ev-card side-${side.cls} ${isNow ? "now" : ""} ${isDone ? "done" : ""}" data-id="${ev.id}">
      <header class="ev-head">
        <span class="ev-time">${fmtTime(ev.start)} – ${fmtTime(ev.end)}</span>
        <span class="side-chip ${side.cls}">${side.label}</span>
        ${badges.join("")}
      </header>
      <h3 class="ev-title">${escapeHtml(ev.title)}</h3>
      ${ev.location ? `<div class="ev-loc">📍 ${escapeHtml(ev.location)}</div>` : ""}
      ${ev.deadline ? `<div class="ev-deadline">⏱ ${escapeHtml(ev.deadline)}</div>` : ""}
      ${warn.length ? `<div class="ev-warn">⏱ Tight handoff — <b>${escapeHtml(warn[0].person)}</b> is needed at "${escapeHtml(warn[0].next)}" straight after</div>` : ""}
      ${ev.tasks?.length ? `<ul class="ev-tasks">${ev.tasks.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
      ${ev.poc?.length ? `<div class="ev-poc"><span class="ev-poc-label">In charge</span>${ev.poc.map((p) => pocChip(p)).join("")}</div>` : ""}
      ${isEditor ? `
        <div class="edit-controls">
          <button class="btn small ghost" data-action="edit" data-id="${ev.id}">Edit</button>
          <button class="btn small ghost" data-action="toggle-done" data-id="${ev.id}">${isDone ? "Unmark done" : "Mark done"}</button>
          <button class="btn small ghost" data-action="toggle-delayed" data-id="${ev.id}">${isDelayed ? "Clear delay" : "Mark delayed"}</button>
        </div>` : ""}
    </article>`;
}

function renderTimeline() {
  const root = document.getElementById("timelineRoot");
  const list = sortedEvents();
  if (!list.length) {
    root.innerHTML = `<p class="empty-note">No events yet.${isEditor ? " Tap Edit schedule to start." : ""}</p>`;
    renderNowNextBar();
    return;
  }
  const now = new Date();
  const nextId = list.find((e) => withDate(e.start) > now)?.id;
  const handoffWarnings = computeHandoffWarnings(list);
  root.innerHTML = `<div class="ev-grid">${list.map((ev) => buildEventCard(ev, now, nextId, handoffWarnings)).join("")}</div>`;

  if (!hasAutoScrolled) {
    hasAutoScrolled = true;
    requestAnimationFrame(() => {
      const target = list.find((e) => now >= withDate(e.start) && now < withDate(e.end)) || list.find((e) => withDate(e.start) > now);
      if (target) document.querySelector(`[data-id="${target.id}"]`)?.scrollIntoView({ behavior: "auto", block: "center" });
    });
  }
  renderNowNextBar();
}

// ---------- single delegated listener for the whole timeline root ----------
document.getElementById("timelineRoot").addEventListener("click", (e) => {
  const pocBtn = e.target.closest('[data-action="poc"]');
  if (pocBtn) { handlePocClick(pocBtn.dataset.name); return; }

  const editBtn = e.target.closest('[data-action="edit"]');
  if (editBtn) { openEventModal(editBtn.dataset.id); return; }

  const doneBtn = e.target.closest('[data-action="toggle-done"]');
  if (doneBtn) {
    const ev = events.find((x) => x.id === doneBtn.dataset.id);
    updateDoc(doc(db, "events", ev.id), { status: ev.status === "done" ? "" : "done" });
    return;
  }
  const delayBtn = e.target.closest('[data-action="toggle-delayed"]');
  if (delayBtn) {
    const ev = events.find((x) => x.id === delayBtn.dataset.id);
    updateDoc(doc(db, "events", ev.id), { status: ev.status === "delayed" ? "" : "delayed" });
  }
});

// ---------- Firestore live sync ----------
onSnapshot(collection(db, "events"), (snap) => {
  events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderTimeline();
}, (err) => {
  document.getElementById("timelineRoot").innerHTML = `<p class="empty-note">Could not load the live schedule.<br>${escapeHtml(err.message)}</p>`;
});
setInterval(() => renderTimeline(), 30000);

// ---------- seating ----------
function renderSeating() {
  document.getElementById("seatTables").textContent = SEATING.totalTables;
  document.getElementById("seatPax").textContent = SEATING.totalPax;
  document.getElementById("seatingRoot").innerHTML = SEATING.tables.map((t) => `
    <div class="table-card">
      <div class="t-name">Table ${escapeHtml(t.table)}</div>
      <div class="t-pax">${t.pax} pax${t.babyChair ? ` · ${t.babyChair} baby chair` : ""}</div>
      ${t.special ? `<div class="t-special">${escapeHtml(t.special)}</div>` : ""}
    </div>`).join("");
}
renderSeating();

// ---------- floor plan (matches the venue's actual seating chart layout) ----------
// Each array is a column, top-to-bottom (nearest the stage first).
// Left block runs outer→inner toward the aisle: 2,3,2,3 (VIP 1 sits atop the
// innermost column, next to 13/12). Right block runs inner→outer from the
// aisle: 3,2,3,2. Both blocks total 10 tables — 20 tables overall.
const FLOORPLAN_LEFT = [["19", "20"], ["18", "17", "16"], ["14", "15"], ["VIP 1", "13", "12"]];
const FLOORPLAN_RIGHT = [["2", "3", "4"], ["5", "6"], ["7", "8", "9"], ["10", "11"]];

function findTable(label) {
  return SEATING.tables.find((t) => t.table === label);
}
function fpDotHtml(label) {
  const isVip = label === "VIP 1";
  const t = findTable(label);
  const hasSpecial = t?.special || t?.babyChair;
  return `<button type="button" class="fp-dot ${isVip ? "vip" : ""} ${hasSpecial ? "special" : ""}" data-action="table" data-table="${escapeHtml(label)}">${isVip ? "VIP" : escapeHtml(label)}</button>`;
}
function renderFloorplan() {
  const root = document.getElementById("floorplanRoot");
  root.innerHTML = `
    <div class="fp-stage">Stage</div>
    <div class="fp-ballroom">
      <div class="fp-block">${FLOORPLAN_LEFT.map((col) => `<div class="fp-col">${col.map((n) => fpDotHtml(n)).join("")}</div>`).join("")}</div>
      <div class="fp-aisle"><div class="fp-aisle-line"></div><span class="fp-aisle-label">Aisle</span></div>
      <div class="fp-block">${FLOORPLAN_RIGHT.map((col) => `<div class="fp-col">${col.map((n) => fpDotHtml(n)).join("")}</div>`).join("")}</div>
    </div>
    <div class="fp-reception">
      <div class="fp-tag">🍦 Bird of Paradise<br><b>Vendor</b></div>
      <div class="fp-tag">📷 Photo Gallery</div>
      <div class="fp-tag">🖼️ Photo Table Area<br><b>Reception Hall</b></div>
      <div class="fp-tag">📸 1010Media<br><b>Photobooth</b></div>
      <div class="fp-tag">📝 <b>Registration Area</b></div>
    </div>`;
}
renderFloorplan();

function openTableModal(label) {
  const t = findTable(label);
  if (!t) return;
  document.getElementById("tableModalTitle").textContent = `Table ${t.table}`;
  document.getElementById("tableModalBody").innerHTML = `
    <div class="tm-row"><b>${t.pax}</b> guests seated here</div>
    ${t.babyChair ? `<div class="tm-row">🍼 <b>${t.babyChair}</b> baby chair${t.babyChair > 1 ? "s" : ""}</div>` : ""}
    ${t.special ? `<div class="tm-row">⚠️ <b>${escapeHtml(t.special)}</b></div>` : ""}
    ${!t.babyChair && !t.special ? `<div class="tm-row">No special requirements.</div>` : ""}
  `;
  document.getElementById("tableModal").classList.add("open");
}
document.getElementById("floorplanRoot").addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="table"]');
  if (btn) openTableModal(btn.dataset.table);
});
document.getElementById("tableModalClose").addEventListener("click", () => document.getElementById("tableModal").classList.remove("open"));
document.getElementById("tableModal").addEventListener("click", (e) => { if (e.target.id === "tableModal") e.currentTarget.classList.remove("open"); });

// ---------- auth ----------
const editScheduleBtn = document.getElementById("editScheduleBtn");
const editorBar = document.getElementById("editorBar");
const loginModal = document.getElementById("loginModal");
const loginError = document.getElementById("loginError");
const ORGANIZER_EMAIL = "weiye98@gmail.com";

function updateEditorUI(user) {
  isEditor = !!user;
  editScheduleBtn.style.display = isEditor ? "none" : "inline-block";
  editorBar.classList.toggle("open", isEditor);
  renderTimeline();
}
onAuthStateChanged(auth, (user) => updateEditorUI(user));

editScheduleBtn.addEventListener("click", () => {
  loginError.style.display = "none";
  document.getElementById("loginPassword").value = "";
  loginModal.classList.add("open");
});
document.getElementById("loginCancel").addEventListener("click", () => loginModal.classList.remove("open"));
document.getElementById("loginSubmit").addEventListener("click", async () => {
  const password = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, ORGANIZER_EMAIL, password);
    loginModal.classList.remove("open");
  } catch (err) {
    loginError.textContent = "Wrong password.";
    loginError.style.display = "block";
  }
});
document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
document.getElementById("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("loginSubmit").click();
});

// ---------- event edit modal ----------
const eventModal = document.getElementById("eventModal");
const evStart = document.getElementById("evStart");
const evEnd = document.getElementById("evEnd");
const evSection = document.getElementById("evSection");
const evSide = document.getElementById("evSide");
const evTitle = document.getElementById("evTitle");
const evLocation = document.getElementById("evLocation");
const evDeadline = document.getElementById("evDeadline");
const evPoc = document.getElementById("evPoc");
const evTasks = document.getElementById("evTasks");
const evStatus = document.getElementById("evStatus");
const eventError = document.getElementById("eventError");
const eventDeleteBtn = document.getElementById("eventDelete");

function openEventModal(id) {
  currentEditId = id || null;
  eventError.style.display = "none";
  const ev = id ? events.find((e) => e.id === id) : null;
  document.getElementById("eventModalTitle").textContent = ev ? "Edit event" : "Add event";
  evStart.value = ev?.start || "";
  evEnd.value = ev?.end || "";
  evSection.value = ev?.section || "Morning";
  evSide.value = ev?.side || "everyone";
  evTitle.value = ev?.title || "";
  evLocation.value = ev?.location || "";
  evDeadline.value = ev?.deadline || "";
  evPoc.value = (ev?.poc || []).join(", ");
  evTasks.value = (ev?.tasks || []).join("\n");
  evStatus.value = ev?.status || "";
  eventDeleteBtn.style.display = ev ? "inline-block" : "none";
  eventModal.classList.add("open");
}
document.getElementById("addEventBtn").addEventListener("click", () => openEventModal(null));
document.getElementById("eventCancel").addEventListener("click", () => eventModal.classList.remove("open"));

document.getElementById("eventSave").addEventListener("click", async () => {
  if (!evStart.value || !evEnd.value || !evTitle.value.trim()) {
    eventError.textContent = "Start time, end time and title are required.";
    eventError.style.display = "block";
    return;
  }
  const payload = {
    section: evSection.value,
    side: evSide.value,
    start: evStart.value,
    end: evEnd.value,
    title: evTitle.value.trim(),
    location: evLocation.value.trim(),
    deadline: evDeadline.value.trim() || null,
    poc: evPoc.value.split(",").map((s) => s.trim()).filter(Boolean),
    tasks: evTasks.value.split("\n").map((s) => s.trim()).filter(Boolean),
    status: evStatus.value,
  };
  try {
    if (currentEditId) await updateDoc(doc(db, "events", currentEditId), payload);
    else await addDoc(collection(db, "events"), { ...payload, order: Date.now() });
    eventModal.classList.remove("open");
  } catch (err) {
    eventError.textContent = err.message;
    eventError.style.display = "block";
  }
});
eventDeleteBtn.addEventListener("click", async () => {
  if (!currentEditId) return;
  if (!confirm("Delete this event for everyone?")) return;
  await deleteDoc(doc(db, "events", currentEditId));
  eventModal.classList.remove("open");
});
