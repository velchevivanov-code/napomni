const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

// Трябва да съвпада със SUPER_ADMINS в index.html
const ADMIN_EMAILS = ["velchevivanov@gmail.com"];

// ══ РАБОТНИ ДНИ (ДОПК чл. 22, ал. 7 — срок, изтичащ в неработен ден, изтича в първия следващ работен ден) ══
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };

// Православен Великден (алгоритъм на Meeus, юлиански → григориански календар, валидно 1900–2099)
function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day + 13));
}

const holidayCache = {};
function bgHolidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const set = new Set();
  const easter = orthodoxEaster(y);
  for (const off of [-2, -1, 0, 1]) { const d = new Date(easter); d.setUTCDate(d.getUTCDate() + off); set.add(iso(d)); }
  const fixed = [[1, 1], [3, 3], [5, 1], [5, 6], [5, 24], [9, 6], [9, 22], [12, 24], [12, 25], [12, 26]];
  for (const [m, d] of fixed) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    set.add(iso(dt));
    // КТ чл. 154, ал. 2 — празник в събота/неделя се почива в следващия работен ден
    if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) {
      const nx = new Date(dt);
      do { nx.setUTCDate(nx.getUTCDate() + 1); } while (nx.getUTCDay() === 0 || nx.getUTCDay() === 6 || set.has(iso(nx)));
      set.add(iso(nx));
    }
  }
  holidayCache[y] = set;
  return set;
}

function nextWorkday(dateIso) {
  let d = parseIso(dateIso);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || bgHolidays(d.getUTCFullYear()).has(iso(d))) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return iso(d);
}

// Статичните срокове за една година (без ЗБУТ — те са Pro и се показват само при emp:true)
function staticDeadlines(Y) {
  const mo = (m, d) => nextWorkday(`${Y}-${pad(m)}-${pad(d)}`);
  return [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `vat${i}`, date: mo(i + 1, 14), title: "Справка-декларация ЗДДС", group: "ДДС", vat: true })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `osw${i}`, date: mo(i + 1, 25), title: "Осигуровки — работодатели", group: "Осигуровки", emp: true })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `oss${i}`, date: mo(i + 1, 25), title: "Осигуровки — СОЛ", group: "Осигуровки", sol: true })),
    ...[4, 7, 10].map((m, i) => ({ id: `corp${i}`, date: mo(m, 15), title: "Авансов корпоративен данък", group: "Данъци" })),
    ...[1, 4, 7, 10].map((m, i) => ({ id: `dpe${i}`, date: mo(m, 31), title: "Декларация по чл. 55 ЗДДФЛ", group: "Данъци" })),
    { id: "kpo", date: mo(6, 30), title: "Годишна декларация ЗКПО", group: "Годишни" },
    { id: "ddfl", date: mo(4, 30), title: "Годишна декларация ЗДДФЛ", group: "Годишни" },
    { id: "sol_izr", date: mo(4, 30), title: "Годишно изравняване — СОЛ", group: "Осигуровки", sol: true },
    { id: "gfo", date: mo(6, 30), title: "ГФО в Търговски регистър", group: "Годишни" },
    { id: "nsi", date: mo(6, 30), title: "Годишен отчет — НСИ", group: "Статистика" },
    { id: "ndi1", date: mo(6, 30), title: "Данък имоти — I вноска", group: "Данъци" },
    { id: "ndi2", date: mo(10, 31), title: "Данък имоти — II вноска", group: "Данъци" },
    { id: "mps1", date: mo(6, 30), title: "Данък МПС — I вноска", group: "Данъци" },
    { id: "mps2", date: mo(10, 31), title: "Данък МПС — II вноска", group: "Данъци" },
    { id: "ch73", date: mo(2, 28), title: "Справки чл.73 ЗДДФЛ", group: "Данъци" },
    { id: "kpo_decl", date: mo(4, 15), title: "Декларация авансови вноски ЗКПО", group: "Данъци" },
    { id: "inv", date: mo(12, 31), title: "Годишна инвентаризация", group: "Годишни" },
  ];
}

// Днешната дата в Европа/София като YYYY-MM-DD
function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

exports.deadlineNotifier = onSchedule(
  { schedule: "every day 08:00", timeZone: "Europe/Sofia", retryCount: 1 },
  async () => {
    const db = admin.firestore();
    const today = parseIso(todayIso());
    const Y = today.getUTCFullYear();
    const daysTo = (dateIso) => Math.round((parseIso(dateIso) - today) / 86400000);

    // Текуща + следваща година, за да работят напомнянията и в края на декември
    const staticDl = [...staticDeadlines(Y), ...staticDeadlines(Y + 1)];

    let customDl = [];
    try {
      const s = await db.collection("deadlines").get();
      customDl = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => typeof d.date === "string");
    } catch (e) { console.warn("deadlines:", e.message); }

    const toNotify = [...staticDl, ...customDl].filter((d) => [7, 1, 0].includes(daysTo(d.date)));
    if (!toNotify.length) { console.log("Push: nothing due"); return; }

    const tokensSnap = await db.collection("fcmTokens").get();
    if (tokensSnap.empty) { console.log("Push: no tokens"); return; }

    const userTokens = {};
    tokensSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (!d.userId || !d.token) return;
      (userTokens[d.userId] = userTokens[d.userId] || []).push({ token: d.token, docId: doc.id });
    });

    const userDocs = await db.getAll(...Object.keys(userTokens).map((uid) => db.collection("users").doc(uid)));
    const usersMap = {};
    userDocs.forEach((doc) => { if (doc.exists) usersMap[doc.id] = doc.data(); });

    let sent = 0, failed = 0;
    const invalid = [];

    for (const [uid, tokens] of Object.entries(userTokens)) {
      const ud = usersMap[uid];
      if (!ud) continue;
      // Push известията са Pro функция
      const isPro = ud.plan === "pro" || ADMIN_EMAILS.includes(ud.email);
      if (!isPro) continue;
      const ac = (ud.cos || []).find((c) => c.active);
      const doneList = ud.done || [];

      const relevant = toNotify.filter((d) => {
        if (doneList.includes(d.id)) return false;
        if (!ac) return true;
        if (d.vat && !ac.vat) return false;
        if (d.sol && !ac.sol && !["ET", "SOL"].includes(ac.lf)) return false;
        if (d.emp && !ac.emp) return false;
        return true;
      });

      for (const d of relevant) {
        const diff = daysTo(d.date);
        const title = diff === 0 ? `⚠️ ДНЕС: ${d.title}` : diff === 1 ? `⏰ УТРЕ: ${d.title}` : `📅 След ${diff} дни: ${d.title}`;
        const body = (d.group || "") + (ac ? ` · ${ac.name}` : "");
        for (const t of tokens) {
          try {
            await admin.messaging().send({
              token: t.token,
              notification: { title, body },
              data: { deadlineId: String(d.id) },
              webpush: { fcmOptions: { link: "/" }, notification: { tag: "napomni-" + d.id, requireInteraction: true } },
            });
            sent++;
          } catch (e) {
            failed++;
            if (e.code === "messaging/invalid-registration-token" || e.code === "messaging/registration-token-not-registered" || e.code === "messaging/invalid-argument") invalid.push(t.docId);
          }
        }
      }
    }

    for (const id of invalid) { try { await db.collection("fcmTokens").doc(id).delete(); } catch (e) { /* ignore */ } }
    console.log(`Push: ${sent} sent, ${failed} failed, ${invalid.length} cleaned`);
  }
);
