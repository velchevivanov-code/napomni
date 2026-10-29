const admin = require('firebase-admin');

// Firebase Admin SDK за Netlify Functions.
// Netlify env: FIREBASE_SERVICE_ACCOUNT = съдържанието на service-account JSON файла
// (Firebase Console → Project settings → Service accounts → Generate new private key),
// подадено като суров JSON или base64.
function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
  }
  return admin;
}

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Проверява Firebase ID token от Authorization: Bearer <token>
async function verifyUser(event) {
  const authz = event.headers.authorization || event.headers.Authorization || '';
  const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!idToken) return null;
  try { return await getAdmin().auth().verifyIdToken(idToken); }
  catch (e) { return null; }
}

module.exports = { getAdmin, json, verifyUser };
