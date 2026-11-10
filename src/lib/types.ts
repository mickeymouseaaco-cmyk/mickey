import type { Timestamp } from 'firebase/firestore';

export type Uid = string;

export type UserProfile = {
  displayName: string;
  coupleId: string | null;
  notificationsPaused: boolean;
  /** Opt-in: transcribe my own voice notes so my partner can read them too. */
  transcribeVoice?: boolean;
  pushTokens?: string[];
  stepGoal: number;
  createdAt?: Timestamp;
};

export type ShareCategory = 'steps' | 'mood' | 'food' | 'cycle' | 'media';
export type ShareSettings = Record<ShareCategory, boolean>;

/** Mood and cycle are private by default. */
export const DEFAULT_SHARE: ShareSettings = {
  steps: true,
  mood: false,
  food: true,
  cycle: false,
  media: false,
};

export type MoodEntry = {
  emoji: string;
  label: string;
  stress: 1 | 2 | 3 | 4 | 5;
  note?: string;
  /** Optional selfie or voice note, always kept in my private storage. */
  media?: { type: 'photo' | 'voice'; path: string; durationMs?: number };
  /** A copy in the couple space, made only if media + mood sharing were on. */
  sharedMediaId?: string;
  at?: Timestamp;
};

export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Meal = { id: string; kind: MealKind; text: string; at: number };
export type FoodLog = { meals?: Meal[]; water?: number };

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export type CycleDay = {
  phase: CyclePhase;
  day: number; // day of cycle, 1-based
  daysUntilNext: number;
  symptoms: string[];
};
/** Private cycle setup. Never shared; only the computed day is projected. */
export type CycleSettings = {
  enabled: boolean;
  lastStart: string; // YYYY-MM-DD
  cycleLength: number;
  periodLength: number;
};

export type CheckIn = {
  text?: string;
  /** Private voice answer, at users/{uid}/private/{id}.{ext}. Never shared. */
  voicePath?: string;
  voiceMs?: number;
  /** Set when the moment was also added to the shared Memory Jar. */
  memoryId?: string;
  at?: Timestamp;
};

export type DailyLog = {
  date: string;
  steps?: number;
  stepGoal?: number;
  mood?: MoodEntry;
  food?: FoodLog;
  cycle?: CycleDay;
  checkIn?: CheckIn;
  updatedAt?: Timestamp;
};

export type SharedDay = {
  ownerId: Uid;
  date: string;
  steps?: number;
  stepGoal?: number;
  mood?: Pick<MoodEntry, 'emoji' | 'label' | 'stress' | 'note'> & { mediaId?: string };
  food?: { meals: Pick<Meal, 'kind' | 'text'>[]; water: number };
  cycle?: CycleDay;
  updatedAt?: Timestamp;
};

export type Gratitude = {
  id: string;
  ownerId: Uid;
  toUid: Uid;
  date: string;
  text?: string;
  mediaId?: string;
  createdAt: Timestamp | null;
};

export type Invite = {
  fromUid: Uid;
  fromName: string;
  status: 'open' | 'accepted' | 'cancelled';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedBy?: Uid;
  coupleId?: string;
};

export type LoveLanguage = 'words' | 'time' | 'service' | 'gifts' | 'touch';

export type Couple = {
  members: [Uid, Uid];
  names: Record<Uid, string>;
  /** Each person's own love languages, most important first. Each edits only their own. */
  loveLanguages?: Record<Uid, LoveLanguage[]>;
  createdAt: Timestamp;
  createdBy: Uid;
  inviteCode: string;
};

export type MessageKind = 'text' | 'photo' | 'voice' | 'video' | 'hug' | 'quick';

export type Message = {
  id: string;
  fromUid: Uid;
  toUid: Uid;
  kind: MessageKind;
  text?: string;
  mediaId?: string;
  voiceHug?: boolean;
  favoriteBy: Uid[];
  /** Starred as important: pinned for both people so it isn't forgotten. Either can star or unstar. */
  important?: boolean;
  importantBy?: Uid;
  readAt?: Timestamp;
  /** View-once note: the recipient can open it once. */
  viewOnce?: boolean;
  /** View-once: when the recipient opened it (the media is deleted right after). */
  viewedAt?: Timestamp;
  /** Disappearing: hidden after this time, and cleaned up by a scheduled function. */
  expiresAt?: Timestamp;
  createdAt: Timestamp | null; // null while the server timestamp is pending
};

export type MediaType = 'photo' | 'voice' | 'video';

export type Media = {
  id: string;
  ownerId: Uid;
  type: MediaType;
  storagePath: string;
  contentType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  bytes: number;
  visibility: 'couple' | 'viewOnce';
  expiresAt?: Timestamp | null;
  allowSave: boolean;
  /** Video poster frame, stored next to the video. */
  thumbPath?: string;
  /** Optional automatic transcript of a voice note (owner opts in). */
  transcript?: string;
  parent: { kind: 'message' | 'memory' | 'trip' | 'gratitude' | 'mood' | 'scheduled'; id: string };
  /** Surprise media: hidden from the partner until this time. */
  hiddenUntil?: Timestamp;
  createdAt: Timestamp | null;
};

export type Memory = {
  id: string;
  ownerId: Uid;
  caption: string;
  date: string;
  location?: string;
  mediaIds: string[];
  createdAt: Timestamp | null;
};
