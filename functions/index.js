const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.deadlineNotifier = functions.pubsub
  .schedule("every day 08:00")
  .timeZone("Europe/Sofia")
  .onRun(async () => {
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const Y = today.getFullYear();
    const mo = (m, d) => `${Y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

    const staticDl = [
      ...Array.from({length:12},(_,i)=>({id:`vat${i}`,date:mo(i+1,14),title:"Справка-декларация ЗДДС",group:"ДДС",vat:true})),
      ...Array.from({length:12},(_,i)=>({id:`osw${i}`,date:mo(i+1,25),title:"Осигуровки — работодатели",group:"Осигуровки",emp:true})),
      ...Array.from({length:12},(_,i)=>({id:`oss${i}`,date:mo(i+1,25),title:"Осигуровки — СОЛ",group:"Осигуровки",sol:true})),
      {id:"kpo",date:mo(6,30),title:"Годишна декларация ЗКПО",group:"Годишни"},
      {id:"ddfl",date:mo(4,30),title:"Годишна декларация ЗДДФЛ",group:"Годишни"},
      {id:"gfo",date:mo(6,30),title:"ГФО в Търговски регистър",group:"Годишни"},
      {id:"nsi",date:mo(6,30),title:"ГОД за НСИ",group:"Статистика"},
    ];

    let customDl = [];
    try { const s = await db.collection("deadlines").get(); customDl = s.docs.map(d=>({id:d.id,...d.data()})); } catch(e){}

    const allDl = [...staticDl, ...customDl];
    const toNotify = allDl.filter(d => {
      const due = new Date(d.date); due.setHours(0,0,0,0);
      const diff = Math.ceil((due - today) / 86400000);
      return [7, 1, 0].includes(diff);
    });

    if (!toNotify.length) return null;

    const tokensSnap = await db.collection("fcmTokens").get();
    if (tokensSnap.empty) return null;

    const userTokens = {};
    tokensSnap.docs.forEach(doc => {
      const d = doc.data();
      if (!userTokens[d.userId]) userTokens[d.userId] = [];
      userTokens[d.userId].push({token: d.token, docId: doc.id});
    });

    const usersSnap = await db.collection("users").get();
    const usersMap = {};
    usersSnap.docs.forEach(doc => { usersMap[doc.id] = doc.data(); });

    let sent = 0, failed = 0;
    const invalid = [];

    for (const [uid, tokens] of Object.entries(userTokens)) {
      const ud = usersMap[uid];
      const ac = (ud?.cos || []).find(c => c.active);
      const doneList = ud?.done || [];

      const relevant = toNotify.filter(d => {
        if (doneList.includes(d.id)) return false;
        if (!ac) return true;
        if (d.vat && !ac.vat) return false;
        if (d.sol && !ac.sol) return false;
        if (d.emp && !ac.emp) return false;
        return true;
      });

      for (const d of relevant) {
        const due = new Date(d.date); due.setHours(0,0,0,0);
        const diff = Math.ceil((due - today) / 86400000);
        const payload = {
          notification: {
            title: diff === 0 ? `⚠️ ДНЕС: ${d.title}` : diff === 1 ? `⏰ УТРЕ: ${d.title}` : `📅 След ${diff} дни: ${d.title}`,
            body: d.group + (ac ? ` · ${ac.name}` : ""),
          }
        };
        for (const t of tokens) {
          try { await admin.messaging().send({token: t.token, ...payload}); sent++; }
          catch(e) { failed++; if(e.code==='messaging/invalid-registration-token'||e.code==='messaging/registration-token-not-registered') invalid.push(t.docId); }
        }
      }
    }

    for (const id of invalid) { try { await db.collection("fcmTokens").doc(id).delete(); } catch(e){} }
    console.log(`Push: ${sent} sent, ${failed} failed, ${invalid.length} cleaned`);
    return null;
  });
