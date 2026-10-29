# НАПомни — Deploy

Приложението е статичен сайт (качва се където и да е, напр. Namecheap в `public_html/app/`).
Сървърната част е във Firebase: правила, push известия и Stripe плащания.

## 1. Качване на сайта (Namecheap)

cPanel → File Manager → `public_html/app/` → качи:

- `index.html`, `service-worker.js`, `manifest.json`, `.htaccess`
- `privacy.html`, `terms.html`, `cookies.html`, `delete-account.html`

Папката `functions/` и файловете `firebase.json`, `firestore.rules`, `.firebaserc`, `*.md` **не** се качват.

При всеки deploy вдигни `CACHE` версията в `service-worker.js`.

## 2. Firebase (веднъж, от компютъра)

Изисква Blaze план (pay-as-you-go; при този трафик е практически безплатно).

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

Stripe ключовете се пазят като Firebase secrets:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Deploy (при първия път ще пита за `STRIPE_PRICE_ID` = `price_...` и `APP_URL` = `https://napomniapp.site/app/`):

```bash
cd functions && npm install && cd ..
```

```bash
firebase deploy --only firestore:rules,functions
```

## 3. Stripe

Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://europe-west1-napomni-abae3.cloudfunctions.net/stripeWebhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

Копирай `whsec_...` ключа и го сложи в `STRIPE_WEBHOOK_SECRET` (стъпка 2), после пак `firebase deploy --only functions`.

Webhook-ът е единственото място, което записва `plan: 'pro'`. Клиентът не може да го промени (виж `firestore.rules`).

## 4. Firebase Auth

Firebase Console → Authentication → Settings → Authorized domains → добави `napomniapp.site` (ако го няма).

## Администратори

Имейлите са на три места и трябва да съвпадат: `ADMINS`/`SUPER_ADMINS` в `index.html`, `isAdmin()` в `firestore.rules`, `ADMIN_EMAILS` в `functions/index.js`.
