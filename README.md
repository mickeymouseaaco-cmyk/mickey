# Together

A gentle daily wellbeing and travel companion for two people. Each partner logs their own day, chooses exactly what the other can see, and sends support with words, photos, voice, and hugs.

Built with **Expo SDK 58 (React Native 0.88, Expo Router)** and **Firebase** (Auth, Firestore real-time sync, Cloud Storage, Cloud Functions).

- Screens and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Screenshots from the two-partner end-to-end run: [`docs/screens/`](docs/screens)
- **Putting it on your phones and in the stores:** [`docs/DEPLOY.md`](docs/DEPLOY.md)

## What's built (MVP + Phase 2 + Phase 3)

| Area | Included |
|---|---|
| Pairing | Invite by 6-character code or `together://pair?code=…` link. The partner sees what sharing means and must **accept** before anything is shared. Either person can unpair at any time. |
| Today (My Day) | Kind daily summary line, steps ring + weekly chart (manual entry, gentle goal), mood check-in (emoji, stress 1–5, note), streak *celebrations only* |
| Their Day | Only what the partner chose to share, live. Gentle heads-up when they share high stress or very high steps. Support ideas that adapt to their mood, stress and steps, with one-tap sends. |
| Privacy | Per-person share toggles (steps, mood, food, cycle, media). **Mood and cycle are off by default.** Turning a toggle off removes that data from the partner's view immediately, including past days. Enforced by security rules, not just the UI. |
| Love Notes | Text, photo (auto-resized, optional caption, "let them save it" flag), hold-to-record voice notes (waveform, slide to cancel, tap to lock), 10-second voice hugs with a soft animation, playback speed 1×/1.5×/2×, hearts → "Saved", quick messages, read receipts, take back a note (removes the media for both people) |
| Hug button | Sends a hug. The partner's phone plays a heartbeat haptic and a blooming heart animation, plus a push notification when the app is closed. |
| Memory Jar | Photo and/or voice clip + caption + date, shared with both. "Remember this day?" throwback. The owner can remove a memory. |
| Vent | Type or talk. Never saved, never uploaded, deleted when you let it go or leave the screen. |
| Comfort & control | PIN app lock with Face ID / fingerprint, one-tap pause for all notifications, kind permission primers before every camera/mic/photos/notifications prompt, gentle errors and empty states, light + dark mode |
| Travel-ready | Persistent upload outbox: retries with backoff, resumes when the connection returns, and shows calm progress ("Your photo will send when you're back online") |
| **Phase 2: Food & water** | Quick meal log (breakfast, lunch, dinner, snack) and a water-glass counter. No calories, no targets. Shared by default; the partner sees only what and how many glasses. |
| **Phase 2: Cycle** | Optional tracker. Phase, day, gentle prediction, and symptom chips. **Private by default**; the setup and dates are never shared. When shared, the partner sees today's phase with tips (warm drink, snacks, patience, take a chore). |
| **Phase 2: Evening check-in** | "What was one good moment today?", typed or spoken. Private; voice goes to the person's own private storage. Optional "also add to our Memory Jar". |
| **Phase 2: Calm Corner** | 2-minute guided breathing (4-2-6, haptics, respects Reduce Motion), three soft looping sounds (rain, ocean, soft hum, generated in-repo), and the private Vent |
| **Phase 2: Gratitude Wall** | One thank-you per person per day (text, photo or voice), enforced by the rules, and a warm weekly summary ("You thanked each other 6 times this week") |
| **Phase 2: Mood calendar** | A month view with both people side by side: your own moods, and only what your partner shared |
| **Phase 2: Media** | 60-second video notes (system trimmer on iOS, poster frame), **view-once** photo/voice/video (recipient opens once, closing deletes the file; screenshots blocked on phones; never saveable), **disappearing** notes (fade after 24h; an hourly function deletes them), and opt-in **voice transcripts** |

| **Love languages** | Each person picks up to two ways they like to be cared for (only their own); the partner's support ideas lead with those |
| **Argument Reset** | Either partner starts it after a tense day: pause, drink water, then share one thing you appreciate. Each appreciation unlocks for the other only after they've shared theirs (enforced by the rules). The other gets a soft push. |
| **Mood selfie or voice** | Optional on a mood check-in. Always kept in private storage; a shared copy is made only if both mood and photo & voice sharing are on, and turning photo & voice off deletes the shared copies |
| **Storage & free up space** | What you've shared (by type), your vault size, the largest items you sent (remove any), and a one-tap clear of on-device caches that never touches anything waiting to send |
| **Private vault** | Photos, videos and voice notes only you can ever see (owner-only storage path) |
| **Save to my phone** | On received photos and videos, only when the sender allowed it |
| **Phase 3: Trips** | Trip tab: next-trip countdown with one small daily task, place lookup, a shared real-time checklist (documents, bookings, packing, extras) where both can tick, weather-aware packing suggestions (forecast within 2 weeks, otherwise the same dates last year, or a "what are you expecting?" fallback), a pre-trip stress check with gentle replies, and a rest-day planner |
| **Phase 3: Travel journal** | Per trip: photo, video, voice diary and note entries with a trip mood, an album, a mood recap, and a full-screen slideshow (cross-fade, gentle zoom off under Reduce Motion) |
| **Phase 3: Bucket list map** | A shared offline world map (Natural Earth outline, no API key) with pins for dreamed-of and visited places |
| **Phase 3: Date Night Generator** | 22 ideas filtered by budget, energy and time; never repeats the last one; send it to your partner in one tap |
| **Phase 3: Milestones** | Anniversary, birthdays, first trip and special days: countdown, years together, a planning prompt that fits how close it is, and reminder pushes a week before, the day before and on the day (never spoiling the birthday person) |
| **Phase 3: Scheduled & surprise notes** | Send a note later, hide a surprise that unlocks on a date, or one waiting for "next time they open the app". Text, photo or voice. The recipient can't read it, or its photo, until it unlocks (rules + storage rules); surprises arrive wrapped and open with confetti |
| **Phase 3: Shared plant** | Grows a little whenever either of you logs, checks in, thanks, hugs or sends love (capped per day). Six stages from seed to flourishing; it never wilts. Couple streaks count days you both cared, celebrated at 3, 7, 14, 30 and 60 |
| **Phase 3: Delight** | Confetti for small wins: step goal reached, both said thank you today, plant grew, streak milestone, everything packed, surprise unwrapped, two calm minutes. It's skipped under Reduce Motion (haptic and kind message instead) |
| **Starred notes** | Star any love note as important. It's pinned in a "To remember" strip for both people, has its own **Starred** filter, and can be starred while writing. Either person can star or unstar. |
| **Shared to-dos** | One gentle list for both: for me, for my partner, or for both of us; today, this week, or someday; star the important ones so they stay on top. Anything earlier simply shows under Today, so nothing is ever "overdue". Turn any love note into a to-do in one tap. Today shows what's on your plate. |
| **Weekend planner** | The coming Saturday and Sunday in morning, afternoon and evening slots. Both add and remove plans live, from your own words, gentle ideas, a date idea or open to-dos. A free-slot count and a kind nudge to leave room to rest. Send the plan as a love note. |
| **Delete my account** | Settings → Delete my account (password to confirm). Unpairs, removes the shared space for both, then the `onAccountDeleted` function removes private logs, vault and files. Required by both app stores. |
| **Phase 3: Widget** | iOS home screen widget (expo-widgets) showing the latest kind word from your partner |

## Run it locally (no Firebase account needed)

```bash
npm install
npm --prefix firebase/tests install      # firebase-tools + rules test deps
npm --prefix functions install
```

Start the emulators (Auth, Firestore, Storage) in one terminal:

```bash
npm run emulators
```

Start the app pointed at them in another:

```bash
npm run dev:local
```

Press `w` for web, or scan the QR code with a development build. On a real phone, set `EXPO_PUBLIC_EMULATOR_HOST` to your computer's LAN IP. Sign up two accounts (e.g. one in a browser, one in a private window) to try both sides.

## Connect a real Firebase project

1. Create a Firebase project, then enable **Email/Password** auth, **Firestore**, and **Storage**.
2. Copy `.env.example` to `.env` and fill in the web app config.
3. Deploy rules, indexes and functions (functions need the Blaze plan):
   ```bash
   npx --prefix firebase/tests firebase deploy --only firestore,storage,functions --project <your-project-id>
   ```
4. For push notifications, run `npx eas-cli@latest init` so `extra.eas.projectId` is set. Users turn alerts on in **Settings → Notifications**.
5. To build installable apps and publish to the App Store and Google Play, follow [`docs/DEPLOY.md`](docs/DEPLOY.md). (The `development` profile in `eas.json` needs `npx expo install expo-dev-client` first.)

## Tests

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint (expo config, React Compiler rules)
npm run test:unit      # 37 tests: sharing, suggestions, love languages, cycle, gratitude, trips, packing, ideas, milestones, plant, streaks, tone, to-dos, weekend planner
npm run test:rules     # 41 security-rule tests on the emulators (privacy guarantees)
```

**End to end, with two partners in two browser sessions against the emulators:**

```bash
npm run emulators
EXPO_PUBLIC_USE_EMULATORS=1 npx expo export --platform web --output-dir dist
node e2e/serve.cjs dist 8099
node e2e/two-partners.cjs
```

The run covers 38 steps. MVP: invite → accept, private-by-default mood, live share/unshare, hug, quick message, text + photo + voice note, heart/saved, take back, Memory Jar, Vent. Phase 2: food & water, cycle (private, then shared with tips), check-in, Calm Corner breathing and sounds, Gratitude Wall from both sides, mood calendar, view-once photo, and a disappearing video. Phase 2 (finish): love languages, Argument Reset from both sides, a private mood selfie, storage, the vault. Phase 3: trip planning with mocked place and weather lookups, a live shared checklist, journal and slideshow, the bucket-list map, date night, milestones, scheduled and surprise notes (unwrapped with confetti, with tomorrow's note staying hidden), and the plant growing. Screenshots are written to `e2e/screens/`.

## Project layout

```
src/app/            screens (Expo Router). (tabs)/ = Today, Their Day, Love Notes, Together, Trip
src/components/     UI kit, charts, voice recorder/player, overlays (hug, lock), feedback (toasts, permission primers)
src/lib/            firebase client, session, pairing, logs + sharing, messages, memories, media, outbox, copy, suggestions
src/theme/          tokens: soft pastels, light + dark, 48pt+ touch targets
firebase/           firestore.rules, storage.rules, indexes, rules tests
functions/          Cloud Functions: push on new note/hug (respects pause), cleanup on unpair
e2e/                two-partner Playwright run
```

## Notes and honest limits

- **Widget (iOS only):** configured through the `expo-widgets` plugin and updated whenever a new kind word arrives. It's untested here because it needs an iOS build. Android widgets aren't enabled yet.
- **Weather and places** come from Open-Meteo, which is free and needs no key, straight from the phone. If it can't be reached, the app asks "what weather are you expecting?" instead. The e2e run mocks these calls.
- **Scheduled notes** become readable to the recipient at their time, and a 10-minute job sends the push. "Next open" surprises are found when the app opens. A phone whose clock runs far ahead of the server sees new notes a little later. The app adapts its safety margin automatically.
- **Deleting a trip** removes the trip and its plan from view. Its checklist and journal sub-items aren't swept yet (a cleanup function is a good next step).

- **Encryption.** Data is encrypted in transit (TLS) and at rest (Google-managed) by Firebase. Only the two members can read shared data, and security rules check that on every request. Media is **not** end-to-end encrypted yet.
- **Steps** are entered by hand for now. Apple Health / Google Fit is a later step.
- **Voice notes recorded on web** are WebM, which iOS can't play. Phone-to-phone uses M4A, which works everywhere.
- **App lock** is native-only (there's no secure keychain on web).
- The **"let them save it"** flag is stored with each photo and voice note, but there's no save-to-device button yet.
- **Transcription** uses Google Cloud Speech-to-Text v2 from a Cloud Function. Enable the Speech-to-Text API and optionally set the `TRANSCRIBE_LANGUAGE` param (default `en-US`). It's typechecked but untested here, because it needs a real project.
- **Disappearing notes** are hidden by the apps once they expire and deleted by the hourly `fadeDisappearingNotes` function. You can also add a Firestore TTL policy on `messages.expiresAt` as a safety net.
- **View-once** blocks screenshots on iOS/Android while the note is open. That's best effort: nothing stops a second camera.
- **Video trimming** uses the iOS system editor. On Android, videos over 60 seconds get a kind "could you trim it?" message instead. Poster frames are made on the phone, not on web.
