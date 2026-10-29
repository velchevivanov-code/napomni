const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getAdmin, json } = require('../lib/firebase-admin');

// Stripe webhook → записва plan: 'pro' / 'free' в users/{uid}.
// Stripe Dashboard → Developers → Webhooks → endpoint: https://<site>/.netlify/functions/stripe-webhook
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
// Netlify env: STRIPE_WEBHOOK_SECRET = whsec_...
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('stripe-webhook signature:', err.message);
    return { statusCode: 400, body: 'Invalid signature' };
  }

  const db = getAdmin().firestore();

  const setPlan = async (uid, plan, extra = {}) => {
    if (!uid) { console.warn('stripe-webhook: no uid for', evt.type); return; }
    await db.collection('users').doc(uid).set({ plan, planUpd: new Date(), ...extra }, { merge: true });
    console.log(`stripe-webhook: ${uid} → ${plan} (${evt.type})`);
  };

  const uidForSubscription = async (sub) => {
    if (sub.metadata && sub.metadata.userId) return sub.metadata.userId;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id;
    if (!customerId) return null;
    const q = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    return q.empty ? null : q.docs[0].id;
  };

  try {
    switch (evt.type) {
      case 'checkout.session.completed': {
        const s = evt.data.object;
        const uid = s.client_reference_id || (s.metadata && s.metadata.userId);
        if (s.mode === 'subscription' && s.status === 'complete') {
          await setPlan(uid, 'pro', {
            stripeCustomerId: typeof s.customer === 'string' ? s.customer : null,
            stripeSubscriptionId: typeof s.subscription === 'string' ? s.subscription : null,
            stripeSubscriptionStatus: 'active',
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = evt.data.object;
        const uid = await uidForSubscription(sub);
        const active = ACTIVE_STATUSES.includes(sub.status);
        await setPlan(uid, active ? 'pro' : 'free', { stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = evt.data.object;
        const uid = await uidForSubscription(sub);
        await setPlan(uid, 'free', { stripeSubscriptionStatus: 'canceled' });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('stripe-webhook handler:', err);
    // 500 → Stripe ще опита отново
    return json(500, { error: 'handler_failed' });
  }

  return json(200, { received: true });
};
