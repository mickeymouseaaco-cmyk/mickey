# Together: screens and data model

A gentle daily wellbeing and travel companion for two people. Both partners
have identical powers. Each person owns their data and decides what the other
sees.

Legend: ✓ = built. Everything listed is now built.

**Status:** MVP, Phase 2 and Phase 3 are built and tested.

### Phase 2 (finish) and Phase 3 data
| Path | Shape | Who |
|---|---|---|
| `couples/{cid}.loveLanguages.{uid}` | `LoveLanguage[]` (≤5) | each edits only their own |
| `couples/{cid}/resets/{date}` | `{ startedBy, date, createdAt }` | either starts; push to the other |
| `…/resets/{date}/notes/{uid}` | `{ text, createdAt }` | owner writes; partner reads **only after writing their own** |
| `users/{uid}/days/{date}.mood.media` | `{ type, path (private), durationMs? }` + `sharedMediaId?` | shared copy only if mood + media sharing |
| `users/{uid}/vault/{id}` | `{ type, path, bytes, … }` | owner only; files in `users/{uid}/private/` |
| `couples/{cid}/trips/{id}` | `{ title, destination, lat, lon, startDate, endDate, weather, stress{uid}, restDays[], createdBy }` | both edit; stress only your own key |
| `…/trips/{id}/items/{itemId}` | `{ text, category, done, doneBy, suggested, addedBy }` | both, one doc per item (no edit conflicts) |
| `…/trips/{id}/entries/{entryId}` | `{ ownerId, type, mediaId?, caption?, mood?, date }` | owner edits/deletes |
| `couples/{cid}/bucket/{pinId}` | `{ name, country, lat, lon, visited, addedBy }` | both; adder deletes |
| `couples/{cid}/milestones/{id}` | `{ title, kind, date, yearly, personUid? }` | both; creator deletes |
| `couples/{cid}/scheduled/{id}` | `{ fromUid, toUid, kind, text?, mediaId?, surprise: none/date/open, deliverAt, favoriteBy, openedAt?, notified }` | recipient can read only when `deliverAt <= request.time` |
| `couples/{cid}/media/{id}.hiddenUntil` | Timestamp | surprise media: partner can't read the record **or the file** until then |
| `couples/{cid}/garden/plant` | `{ points, lastCareBy }` | grows by 1–3 per write, never shrinks |
| `couples/{cid}/care/{date}` | `{ who: uid[] }` | each adds only themselves (for couple streaks) |
| `couples/{cid}/messages/{id}.important` | `bool` + `importantBy` | starred note, pinned for both; either stars, only as themselves |
| `couples/{cid}/todos/{id}` | `{ text, forUid (uid or 'both'), dueDate (YYYY-MM-DD or null), important, done, doneBy?, doneAt?, addedBy, fromMessageId?, createdAt }` | both add, tick, star, remove; a tick is signed by whoever ticks |
| `couples/{cid}/plans/{id}` | `{ date, slot: morning/afternoon/evening, text, addedBy, todoId?, createdAt }` | weekend planner; both add, move, remove |

Storage reads are now `get`-only (no listing). A partner can fetch a file only once its Firestore record exists and isn't hidden.

---

## 1. Screens

### Before you're paired
| Screen | Route | Phase |
|---|---|---|
| Welcome / sign in / create account | `/sign-in` | MVP |
| Pair: create an invite (code + share link) | `/pair` | MVP |
| Pair: enter a code, see who invited you, accept or decline | `/pair?code=…` (deep link `together://pair?code=…`) | MVP |
| Waiting for your partner to accept | `/pair` (invite open) | MVP |

Nothing is shared until the invited partner taps **Accept**.

### Bottom tabs (5)
| Tab | Route | Contents | Phase |
|---|---|---|---|
| **Today** (My Day) | `/(tabs)` | My Day / Their Day switch, daily summary line, steps ring and weekly chart, mood card, links to Calm Corner and Vent | MVP |
| | | Food + water card, cycle card, evening check-in, Calm Corner entry | P2 ✓ |
| **Their Day** | `/(tabs)/their-day` | Only what the partner chose to share: steps, mood and stress, plus support ideas that adapt to them, a hug button and quick messages | MVP |
| | | Shared food, shared cycle phase with gentle tips | P2 ✓ |
| **Love Notes** | `/(tabs)/notes` | Conversation-style feed; composer for text, photo and a hold-to-record voice note; quick messages; hug button; heart to save favourites; "Saved" filter | MVP |
| | | Video (60s, poster frame), view-once, disappearing (24h), transcripts | P2 ✓ |
| | | Scheduled sends, surprise notes | P3 ✓ |
| **Together** | `/(tabs)/together` | Memory Jar (photo + voice + caption + date) | MVP |
| | | To-dos and weekend planner tiles | ✓ |
| | | Gratitude Wall, mood calendar | P2 ✓ |
| | | Argument Reset, love languages | P2 ✓ |
| | | Milestones, Date Night Generator, mascot/plant | P3 ✓ |
| **Trip** | `/(tabs)/trip` | Kind "coming soon" empty state | MVP |
| | | Checklist, packing, countdown, bucket-list map, journal, slideshow | P3 ✓ |

### Modals and stack screens
| Screen | Route | Phase |
|---|---|---|
| Log steps (manual, quick +1k chips, goal) | `/log-steps` | MVP |
| Log mood (emoji, stress 1–5, note, optional selfie/voice) | `/log-mood` | MVP (selfie/voice note attach: P2) |
| Vent (text or voice, never uploaded, deleted on close) | `/vent` | MVP |
| New memory (photo/voice + caption + date) | `/memory-new` | MVP |
| Memory detail (view, play, delete if yours) | `/memory/[id]` | MVP |
| Settings (name, app lock, pause notifications, unpair, sign out) | `/settings` | MVP |
| Privacy: what my partner sees | `/privacy` | MVP |
| Unlock (PIN / biometric gate) | overlay in root layout | MVP |
| Calm Corner (2-min breathing, soft sounds, vent) | `/calm` | P2 ✓ |
| Cycle setup + today's symptoms | `/cycle` | P2 ✓ |
| Evening check-in (typed or voice, optional Memory Jar) | `/check-in` | P2 ✓ |
| Gratitude Wall + weekly summary | `/gratitude` | P2 ✓ |
| Mood calendar (month, side by side) | `/mood-calendar` | P2 ✓ |
| Storage and free up space | `/storage` | P2 ✓ |
| Private media vault | `/vault` | P2 ✓ |
| Shared to-dos (who, when, starred; never overdue) | `/todos` | ✓ |
| Weekend planner (Sat/Sun × morning/afternoon/evening) | `/weekend` | ✓ |

---

## 2. Privacy model (enforced on the server, not only in the UI)

The core idea: **private data and shared data live in different places**, and
security rules only let the partner read the shared place.

```
users/{uid}/days/{date}           ← full private log. Owner-only.
couples/{cid}/shared/{uid_date}   ← projection containing ONLY the categories
                                    the owner has toggled on. Owner writes,
                                    both members read.
```

* When you log, the app writes your private day, then rewrites your shared
  projection from your current `ShareSettings`.
* When you turn a toggle **off**, the app deletes that field from every one of
  your shared day docs. Turning it **on** shares only from that point on
  (today's value is re-projected; older days stay private).
* Mood and cycle default to **off**. Vent, journal and vault have no shared
  representation at all; there is nothing to toggle.
* "Not shared" and "not logged" look the same to the partner ("Nothing shared
  here yet"), so a hidden category reveals nothing.
* Media is uploaded **only when sent** (in a note) or added to a shared space
  (Memory Jar). Until then it stays on the device.
* The owner of any message, memory or media can delete it at any time. That
  removes the Storage object and the doc, so it disappears from the partner's
  view too.
* In transit: TLS (Firebase default). At rest: Google-managed encryption
  (Firestore and Cloud Storage default). On device: optional PIN/biometric lock;
  the PIN hash lives in SecureStore. End-to-end encryption of media is a
  candidate for later and is **not** claimed today.

---

## 3. Data model (Firestore + Cloud Storage)

All timestamps are Firestore `Timestamp`s. All `date` keys are local
`YYYY-MM-DD`.

### `users/{uid}`: **User** (owner only)
| field | type | notes |
|---|---|---|
| displayName | string | |
| coupleId | string \| null | set only after acceptance |
| notificationsPaused | boolean | the one-tap pause; Cloud Function respects it |
| pushTokens | string[] | Expo push tokens |
| stepGoal | number | default 8000, gentle and editable |
| loveLanguages | string[] | P2 |
| createdAt | Timestamp | |

### `users/{uid}/settings/share`: **ShareSettings** (owner only)
`{ steps: true, mood: false, food: true, cycle: false, media: false, updatedAt }`

### `users/{uid}/days/{date}`: **DailyLog** (owner only)
| field | type | phase |
|---|---|---|
| date | string | MVP |
| steps | number | MVP |
| stepGoal | number | MVP |
| mood | `{ emoji, label, stress 1–5, note?, at }` | MVP |
| food | `{ meals: [{ id, kind, text, at }], water: number }` | P2 ✓ |
| cycle | `{ phase, day, daysUntilNext, symptoms[] }`, computed from private `settings/cycle` (`lastStart, cycleLength, periodLength`), which is never shared | P2 ✓ |
| checkIn | `{ text?, voicePath? (users/{uid}/private/…), voiceMs?, memoryId? }` (never projected) | P2 ✓ |

### `invites/{code}`: **Invite**
`{ fromUid, fromName, status: 'open'|'accepted'|'cancelled', createdAt,
expiresAt (48h), acceptedBy?, coupleId? }`. Anyone signed in can `get` a code
(it's a 6-character capability with 30 bits of entropy and an expiry). Nobody can
`list` codes. Only the inviter can cancel.

### `couples/{cid}`: **Couple**
`{ members: [uidA, uidB], names: { uid: name }, createdAt, createdBy }`.
Created by the **accepting** partner in the same batch that marks the invite
accepted. The rules check the invite is open, unexpired and from the other
member.

### `couples/{cid}/shared/{uid}_{date}`: **SharedDay**
`{ ownerId, date, steps?, stepGoal?, mood?: { emoji, label, stress, note? }, updatedAt }`

### `couples/{cid}/messages/{id}`: **Message** (Love Note)
| field | type | notes |
|---|---|---|
| fromUid / toUid | string | |
| kind | `'text'\|'photo'\|'voice'\|'hug'\|'quick'` (+ `video`, `surprise` later) | |
| text | string? | caption or body |
| mediaId | string? | → Media |
| favoriteBy | string[] | the heart. Each person can only add or remove themselves |
| readAt | Timestamp? | set by recipient |
| deliverAt | Timestamp? | scheduled / surprise (P2/P3) |
| createdAt | Timestamp | |

### `couples/{cid}/memories/{id}`: **Memory**
`{ ownerId, caption, date, location?, mediaIds: string[], createdAt }`

### `couples/{cid}/media/{id}`: **Media**
| field | type | notes |
|---|---|---|
| ownerId | string | |
| type | `'photo'\|'voice'\|'video'` | |
| storagePath | string | `couples/{cid}/media/{ownerId}/{id}.{ext}` |
| contentType | string | |
| width, height | number? | photos are resized to ≤1600px on device |
| durationMs | number? | voice ≤ 5 min, video ≤ 60 s |
| bytes | number | for the storage screen |
| visibility | `'couple'\|'viewOnce'` | view-once: the recipient may delete it after opening; `allowSave` is forced false |
| expiresAt | Timestamp? | disappearing: ≤ 25h; hidden by clients, deleted by the hourly `fadeDisappearingNotes` |
| thumbPath | string? | video poster frame `{mediaId}_thumb.jpg` |
| transcript | string? | voice notes, written by `transcribeVoiceNote` if the owner opted in |
| allowSave | boolean | may the partner save it to their device |
| parent | `{ kind: 'message'\|'memory'\|'trip', id }` | |
| createdAt | Timestamp | |

### `couples/{cid}/gratitude/{uid}_{date}`: **Gratitude** (P2 ✓)
`{ ownerId, toUid, date, text?, mediaId?, createdAt }`. The doc id enforces one thank-you per person per day, and it's create-only.

### Message additions (P2 ✓)
`kind` adds `'video'`; `viewOnce?: true`, `viewedAt?` (set once, by the recipient), `expiresAt?` (≤ 25h).

### Private storage (P2 ✓)
`users/{uid}/private/{file}` is owner-only (read, create, delete). Used for voice check-ins.

### `couples/{cid}/trips/{id}`: **Trip** (P3)
`{ title, destination, startDate, endDate, checklist: [{ id, text, done, by }],
packing[], bucketPins[], createdBy }`, with `trips/{id}/entries` for the
journal.

### Storage layout
```
couples/{cid}/media/{ownerUid}/{mediaId}.jpg|m4a|mp4
```
Rules: the couple's members can read; only `ownerUid` can write or delete;
images must be under 5 MB and audio under 20 MB.

---

## 4. Real-time and notifications

* Both apps subscribe with `onSnapshot` to the partner's shared days, messages
  and memories, so updates appear live.
* A hug that arrives while the app is open plays a haptic pattern and a soft
  heart animation.
* The `onMessageCreated` Cloud Function sends an Expo push notification to the
  recipient unless their `notificationsPaused` is on. Hugs use a long-vibration
  Android channel.

## 5. Offline and bad connections

* Firestore queues writes while offline.
* Media uploads go through a persistent queue (AsyncStorage + a copy of the
  file in the app's document directory). It retries with backoff and resumes
  when the connection returns. The note shows "Waiting to send…" instead of an
  error.
