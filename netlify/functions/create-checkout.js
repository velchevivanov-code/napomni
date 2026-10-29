const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getAdmin, json, verifyUser } = require('../lib/firebase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    console.error('create-checkout: STRIPE_SECRET_KEY / STRIPE_PRICE_ID not configured');
    return json(500, { error: 'not_configured' });
  }

  // Потребителят се взима от Firebase ID token, не от тялото на заявката
  const user = await verifyUser(event);
  if (!user) return json(401, { error: 'unauthenticated' });

  try {
    const db = getAdmin().firestore();
    const snap = await db.collection('users').doc(user.uid).get();
    const ud = snap.exists ? snap.data() : {};
    if (ud.plan === 'pro') return json(409, { error: 'already_pro' });

    const base = process.env.URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(ud.stripeCustomerId ? { customer: ud.stripeCustomerId } : { customer_email: user.email }),
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${base}/?checkout=success`,
      cancel_url: `${base}/?checkout=cancel`,
      client_reference_id: user.uid,
      metadata: { userId: user.uid },
      subscription_data: { metadata: { userId: user.uid } },
      allow_promotion_codes: true,
      locale: 'bg',
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error('create-checkout:', err);
    return json(500, { error: 'checkout_failed' });
  }
};
