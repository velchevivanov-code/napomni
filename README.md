# ⚖️ НАПомни v2.1 — Пълен Setup Guide

## 📋 Какво е включено

| Файл | Описание |
|------|----------|
| `index.html` | Основно PWA приложение (подобрено v2.1) |
| `manifest.json` | PWA manifest с икони и мета данни |
| `service-worker.js` | Cache-first стратегия за офлайн работа |
| `firebase-messaging-sw.js` | Background push нотификации (FCM) |
| `firebase.json` | Firebase hosting + functions конфигурация |
| `firestore.rules` | Firestore security rules |
| `functions/index.js` | Cloud Functions — CRON push нотификации |
| `functions/package.json` | Dependencies за Cloud Functions |

---

## 🔧 Какво е подобрено спрямо v2.0

### ✅ Нови функции
- **FCM Push Notifications** — реални push известия 7 дни / 1 ден / в деня
- **Background messaging** — получавате нотификации дори когато app-ът е затворен
- **Foreground messaging** — toast + native notification при отворен app
- **PWA Install бутон** — в Настройки, ако браузърът поддържа
- **Автоматичен token refresh** — при всяко влизане
- **Token cleanup** — Cloud Function изчиства стари токени (60+ дни)
- **User-specific filtering** — push-ите се филтрират по фирма (ДДС/СОЛ/работодател)

### 🐛 Поправени бъгове
- **CSS `.co-btn`** — липсващ клас за бутони на фирми (сега е стилизиран)
- **CSS `.a-box` конфликт** — auth box и alert box имаха еднакъв клас
- **`confirm()` shadowing** — преименуван на `showConfirm()` за да не конфликтира с native
- **Manifest.json** — добавени icons, categories, description, lang
- **Service Worker** — пълна cache стратегия вместо минимална
- **Липсващ `<link rel="manifest">`** — добавен в `<head>`
- **Липсваща SW регистрация** — добавена в `initApp()`

---

## 🚀 Стъпки за деплой

### Стъпка 1: Firebase Console
1. Отиди на [Firebase Console](https://console.firebase.google.com)
2. Отвори проект `taxalert-7929e` (или създай нов)
3. Включи:
   - **Authentication** → Email/Password + Google
   - **Firestore** → Native mode
   - **Cloud Messaging**
   - **Cloud Functions** (⚠️ изисква Blaze план)

### Стъпка 2: VAPID Key
1. Firebase Console → Project Settings → Cloud Messaging
2. Секция "Web Push certificates" → Generate key pair
3. Копирай VAPID key и го сложи в `index.html`:
```javascript
const VAPID_KEY="тук_сложи_vapid_key";
```

### Стъпка 3: Admin имейл
В `index.html` намери:
```javascript
const ADMINS=["тук_сложи_твоя_имейл@gmail.com"];
```
Замени с истинския ти имейл.

Също обнови `firestore.rules` със същия имейл.

### Стъпка 4: Инсталиране на Functions
```bash
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
```

### Стъпка 5: Deploy

**Вариант A — Firebase Hosting:**
```bash
firebase deploy
```

**Вариант B — Netlify:**
1. Качи файловете в Git repo (без `functions/` папката)
2. Свържи с Netlify
3. Functions-ите деплойни отделно:
```bash
firebase deploy --only functions,firestore:rules
```

---

## 🧪 Тестване

### Тест на Push нотификации
1. Отвори app-а
2. Влез с Google или email
3. Отиди на ⚙️ Настройки → включи 🔔 Push известия
4. Разреши notifications в браузъра
5. Проверка: Firebase Console → Cloud Messaging → Send test message

### Тест на CRON функцията
За бърз тест, временно промени schedule-а:
```javascript
// В functions/index.js:
.schedule("every 5 minutes")  // вместо "every day 08:00"
```
```bash
firebase deploy --only functions
```
Върни обратно на `"every day 08:00"` след теста.

---

## 📊 Firestore структура

```
users/
  {userId}/
    name, email, photo, cos[], rem[], lastLogin

fcmTokens/
  {tokenId}/
    token, userId, email, created, lastRefresh, device

deadlines/  (custom, добавени от админ)
  {deadlineId}/
    title, group, date, color, sub, note, full, law, lawUrl, action, penalty
```

---

## ⚡ Netlify специфики

Ако хостваш на Netlify, трябва да добавиш `_headers` файл:

```
/firebase-messaging-sw.js
  Service-Worker-Allowed: /
```

И `_redirects`:
```
/*    /index.html   200
```

---

## 💰 Разходи

| Компонент | Безплатен лимит | Цена след |
|-----------|----------------|-----------|
| Firestore | 50K reads/day | $0.06/100K |
| Cloud Functions | 2M invocations/month | $0.40/million |
| FCM | **Безплатен** | Безплатен |
| Auth | **Безплатен** | Безплатен |

За ~100 потребители: **$0/месец** (в рамките на безплатния план)

---

## 📱 Поддържани браузъри за Push

| Браузър | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ | ✅ Android |
| Firefox | ✅ | ✅ Android |
| Edge | ✅ | ✅ |
| Safari | ✅ 16.4+ | ✅ iOS 16.4+ (PWA mode) |
| Samsung Internet | — | ✅ |

⚠️ **iOS Safari** поддържа push САМО когато app-ът е инсталиран като PWA (Add to Home Screen) и iOS е 16.4+.
