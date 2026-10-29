# НАПомни — Deploy

## Netlify (сайт + плащания)

Environment variables (Site settings → Environment variables):

| Име | Стойност |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_PRICE_ID` | `price_...` (месечен абонамент 9.99 лв) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (от webhook-а по-долу) |
| `FIREBASE_SERVICE_ACCOUNT` | JSON на service account (Firebase Console → Project settings → Service accounts → Generate new private key), суров или base64 |

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://<домейн>/.netlify/functions/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

Webhook-ът е единственото място, което записва `plan: 'pro'` в `users/{uid}`. Клиентът не може да го промени (виж `firestore.rules`).

## Firebase (правила + push)

```bash
firebase deploy --only firestore:rules
```

```bash
cd functions && npm install && cd .. && firebase deploy --only functions
```

Cloud Functions изисква Blaze план. `deadlineNotifier` пуска push всеки ден в 08:00 (София) само на Pro потребители.

## Администратори

Имейлите са на три места и трябва да съвпадат: `ADMINS`/`SUPER_ADMINS` в `index.html`, `isAdmin()` в `firestore.rules`, `ADMIN_EMAILS` в `functions/index.js`.

## При всеки deploy

Вдигни `CACHE` версията в `service-worker.js`.
