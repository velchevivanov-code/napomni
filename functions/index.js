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
              webpush: { fcmOptions: { link: APP_URL.value() }, notification: { tag: "napomni-" + d.id, requireInteraction: true } },
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

// ══ STRIPE ══
// Secrets: firebase functions:secrets:set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
// Params (питат се при deploy): STRIPE_PRICE_ID, APP_URL
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_PRICE_ID = defineString("STRIPE_PRICE_ID");
// Адресът на приложението — за връщане след плащане
const APP_URL = defineString("APP_URL", { default: "https://napomniapp.site/app/" });
const REGION = "europe-west1";
const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

function appOrigin() { return new URL(APP_URL.value()).origin; }

exports.createCheckout = onRequest({ region: REGION, secrets: [STRIPE_SECRET_KEY], cors: false }, async (req, res) => {
  // CORS само за домейна на приложението (+ localhost за тестове)
  const origin = req.get("Origin") || "";
  const allowed = origin === appOrigin() || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (allowed) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "POST");
  }
  if (req.method === "OPTIONS") { res.status(allowed ? 204 : 403).send(""); return; }
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  // Потребителят се взима от Firebase ID token, не от тялото на заявката
  const authz = req.get("Authorization") || "";
  let user;
  try { user = await admin.auth().verifyIdToken(authz.startsWith("Bearer ") ? authz.slice(7) : ""); }
  catch (e) { res.status(401).json({ error: "unauthenticated" }); return; }

  try {
    const stripe = require("stripe")(STRIPE_SECRET_KEY.value());
    const snap = await admin.firestore().collection("users").doc(user.uid).get();
    const ud = snap.exists ? snap.data() : {};
    if (ud.plan === "pro") { res.status(409).json({ error: "already_pro" }); return; }

    const base = APP_URL.value();
    const sep = base.includes("?") ? "&" : "?";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(ud.stripeCustomerId ? { customer: ud.stripeCustomerId } : { customer_email: user.email }),
      line_items: [{ price: STRIPE_PRICE_ID.value(), quantity: 1 }],
      success_url: `${base}${sep}checkout=success`,
      cancel_url: `${base}${sep}checkout=cancel`,
      client_reference_id: user.uid,
      metadata: { userId: user.uid },
      subscription_data: { metadata: { userId: user.uid } },
      allow_promotion_codes: true,
      locale: "bg",
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("createCheckout:", err);
    res.status(500).json({ error: "checkout_failed" });
  }
});

// Stripe Dashboard → Developers → Webhooks → https://europe-west1-<project>.cloudfunctions.net/stripeWebhook
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
// Единственото място, което записва plan: 'pro' / 'free' в users/{uid}.
exports.stripeWebhook = onRequest({ region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
  const stripe = require("stripe")(STRIPE_SECRET_KEY.value());
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(req.rawBody, req.get("stripe-signature"), STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    console.error("stripeWebhook signature:", err.message);
    res.status(400).send("Invalid signature");
    return;
  }

  const db = admin.firestore();
  const setPlan = async (uid, plan, extra = {}) => {
    if (!uid) { console.warn("stripeWebhook: no uid for", evt.type); return; }
    await db.collection("users").doc(uid).set({ plan, planUpd: new Date(), ...extra }, { merge: true });
    console.log(`stripeWebhook: ${uid} → ${plan} (${evt.type})`);
  };
  const uidForSubscription = async (sub) => {
    if (sub.metadata && sub.metadata.userId) return sub.metadata.userId;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer && sub.customer.id;
    if (!customerId) return null;
    const q = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
    return q.empty ? null : q.docs[0].id;
  };

  try {
    switch (evt.type) {
      case "checkout.session.completed": {
        const s = evt.data.object;
        const uid = s.client_reference_id || (s.metadata && s.metadata.userId);
        if (s.mode === "subscription" && s.status === "complete") {
          await setPlan(uid, "pro", {
            stripeCustomerId: typeof s.customer === "string" ? s.customer : null,
            stripeSubscriptionId: typeof s.subscription === "string" ? s.subscription : null,
            stripeSubscriptionStatus: "active",
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = evt.data.object;
        await setPlan(await uidForSubscription(sub), ACTIVE_STATUSES.includes(sub.status) ? "pro" : "free",
          { stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status });
        break;
      }
      case "customer.subscription.deleted": {
        await setPlan(await uidForSubscription(evt.data.object), "free", { stripeSubscriptionStatus: "canceled" });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("stripeWebhook handler:", err);
    res.status(500).json({ error: "handler_failed" }); // Stripe ще опита отново
    return;
  }
  res.json({ received: true });
});
