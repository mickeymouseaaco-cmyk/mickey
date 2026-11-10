# Putting Together on your phones (and in the stores)

This is the whole path from this repo to the App Store and Google Play, in order.
You only do steps 1–5 once. After that, a new version is just step 7.

Commands run on **your computer**, in this project folder. EAS (Expo's build
service) builds the iPhone and Android apps in the cloud, so you don't need a
Mac or Android Studio.

---

## What you need first

| What | Cost | Where |
|---|---|---|
| A computer with Node.js 20 or newer | free | nodejs.org |
| A Firebase project (Blaze plan, for the Cloud Functions) | pay-as-you-go; tiny for two people, set a budget alert | console.firebase.google.com |
| An Expo account | free | expo.dev/signup |
| Apple Developer Program (iPhone) | US$99 a year | developer.apple.com/programs |
| Google Play Console (Android) | US$25, once | play.google.com/console |

Check current prices when you sign up. You can do Android first and add iPhone later.

---

## 1. Install the project

```bash
npm install
npm --prefix functions install
npm --prefix firebase/tests install
```

Run the checks once so you start from green:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:rules     # needs Java for the Firebase emulator
```

## 2. Set up Firebase

1. Create a project at console.firebase.google.com.
2. **Authentication** → Sign-in method → turn on **Email/Password**.
3. **Firestore Database** → Create, in production mode. For Malaysia, `asia-southeast1` (Singapore) is the closest region.
4. **Storage** → Get started, same region.
5. Switch the project to the **Blaze** plan (needed for Cloud Functions), and set a budget alert (for example US$5).
6. Project settings → **Your apps** → add a **Web app**. Keep its config values open; you need them in step 4.
7. Deploy the security rules, indexes and functions:

   ```bash
   npx --prefix firebase/tests firebase login
   npx --prefix firebase/tests firebase deploy --only firestore,storage,functions --project <your-project-id>
   ```

8. Optional: for voice-note transcripts, enable the **Cloud Speech-to-Text API** in Google Cloud for the same project.

## 3. Give the app its own name in the stores

`app.json` uses the bundle ID `app.together.couple`. Store IDs must be unique worldwide,
so change both of these to something that's yours, for example `com.afiqaina.together`:

- `expo.ios.bundleIdentifier`
- `expo.android.package`

Pick it once. It can't change after the first store release.

## 4. Connect Expo (EAS) and add your Firebase settings

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` links the project to your Expo account and writes its project ID into `app.json`
(push notifications need it). Commit that change.

Your `.env` file stays on your computer, so give EAS the same values. Do this for each
of the six values, and for both the `preview` and `production` environments:

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_FIREBASE_API_KEY --value <value> --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_FIREBASE_API_KEY --value <value> --environment preview --visibility plaintext
```

The six names are in `.env.example`. These Firebase web values are meant to be in the app
(the security rules are what keep your data private), so `plaintext` is right.

## 5. Push notifications

- **iPhone:** nothing extra. The first iOS build asks to create the push key for you; say yes.
- **Android:** Expo's push service needs Firebase Cloud Messaging:
  1. In Firebase, add an **Android app** with the same package name as step 3, and download `google-services.json` into the project root.
  2. In `app.json`, add `"googleServicesFile": "./google-services.json"` inside `expo.android`.
  3. Firebase → Project settings → Service accounts → **Generate new private key**. Upload it with
     `npx eas-cli@latest credentials` → Android → production → Google Service Account → FCM V1.

## 6. Try it on your own phones first

**Android:** this makes an install link you can open on both phones:

```bash
npx eas-cli@latest build --profile preview --platform android
```

**iPhone:** internal builds only install on registered phones. Register each iPhone once,
then build:

```bash
npx eas-cli@latest device:create
npx eas-cli@latest build --profile preview --platform ios
```

Or skip this and use TestFlight (step 7). It's often easier for iPhones.

Test pairing, a hug, a voice note, the to-dos and the weekend planner between the two phones.

## 7. Build and send to the stores

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```

- **iPhone:** the build goes to App Store Connect, then to **TestFlight**. Add yourselves as testers and install it from the TestFlight app.
- **Android:** Google needs the **very first** upload to be done by hand. Download the `.aab` from the build page on expo.dev and upload it in Play Console → Testing → **Internal testing**. After that, `eas submit` works every time.

Version numbers go up automatically on each production build (`autoIncrement` in `eas.json`).

## 8. Store listings (before public release)

Both stores ask for the same things:

- **Privacy policy URL.** Say plainly what's stored: email, display name, steps, mood, food, optional cycle data, photos, videos and voice notes. Say who sees it (only you, and only what you choose to share with your partner) and how to delete it (Settings → Delete my account).
- **Apple App Privacy** and **Google Data safety** forms: health & fitness (steps, cycle), user content (photos, audio, messages), contact info (email). Not used for tracking or ads. Data is encrypted in transit. Users can delete their account in the app.
- **Screenshots.** There are some in `docs/screens/` to start from. Apple needs 6.9" iPhone sizes; Play needs at least two phone screenshots.
- **Age rating** questionnaire, a short and long description, a support email, and the app icon (already in `assets/`).
- **Test account for reviewers.** Apple will want to sign in and see two people paired. Create two test accounts, pair them, and give the reviewer one of the logins in the review notes.

Apple review usually takes a day or two. Google's first review can take a few days.

## 9. Small fixes later, without a new store review

For JavaScript-only changes (copy, colours, layout, logic), you can send an over-the-air
update. Set it up once with `npx eas-cli@latest update:configure`, then publish with
`npx eas-cli@latest update --environment production --message "..."`. Anything that
adds a native package still needs a new build (step 7).

---

### If something goes wrong

- **Build fails:** open the build page on expo.dev and read the first red error in the logs. `npx expo-doctor` catches most setup problems.
- **App opens to the "set up Firebase" screen:** the `EXPO_PUBLIC_FIREBASE_*` values weren't set for that build's environment (step 4).
- **No push notifications:** check Settings → "Turn on hug & love note alerts" on the phone, step 5, and that the functions are deployed (step 2.7).
