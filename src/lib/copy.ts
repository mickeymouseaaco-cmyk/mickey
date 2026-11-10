/**
 * Every user-facing sentence that carries tone lives here, so the voice stays
 * consistent: warm, calm, never clinical, never shaming.
 */

export const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😌', label: 'Calm' },
  { emoji: '🥰', label: 'Loved' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '😟', label: 'Worried' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😤', label: 'Frustrated' },
] as const;

export const STRESS_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Very light',
  2: 'Light',
  3: 'In the middle',
  4: 'Heavy',
  5: 'Very heavy',
};

export const QUICK_MESSAGES = [
  'Proud of you',
  "Rest tonight, I've got dinner",
  'Thinking of you',
  "I'm here. No need to reply.",
  'You make my day better',
  'Drink some water, love',
] as const;

export const empty = {
  theirDayUnpaired: 'Once you two are connected, the little things they share will appear here.',
  theirDayNothing: (name: string) => `Nothing shared from ${name} yet today. A gentle hello is always welcome.`,
  notes: 'No love notes here yet. Let’s send the first one.',
  favorites: 'Tap the heart on any note to keep it here.',
  starred: 'Nothing starred yet. Tap the star on anything you both need to remember.',
  todos: 'Nothing on the list. Enjoy the space.',
  todosToday: 'Nothing left for today. Enjoy the space.',
  weekendSlot: 'Free. That’s okay too.',
  memories: 'No memories here yet. Let’s make one.',
  steps: 'No steps logged yet. Every little walk counts.',
  mood: 'How are you feeling? There’s no wrong answer.',
  trip: 'Trip planning is on its way. Where would you two like to go first?',
} as const;

export const gentleError = {
  send: 'That didn’t send. Let’s try again in a moment.',
  save: 'That didn’t save just yet. Let’s try again in a moment.',
  load: 'We couldn’t load this right now. It’ll be here when the connection is back.',
  offline: 'You’re offline. We’ll send it as soon as you’re connected.',
  code: 'That code didn’t match an open invite. Could you check it with your partner?',
  signIn: 'That didn’t work. Could you check your email and password?',
} as const;

/** The daily summary line on Today. Always kind, whatever the numbers say. */
export function summaryLine(steps: number | undefined, stress?: number): string {
  if (stress && stress >= 4) return 'Today felt heavy. Be extra gentle with yourself tonight.';
  if (!steps) return 'A quiet day is still a good day.';
  const s = steps.toLocaleString();
  if (steps >= 12000) return `You walked ${s} steps today. Your feet deserve a rest.`;
  if (steps >= 5000) return `You walked ${s} steps today. Be gentle with yourself.`;
  return `You walked ${s} steps today. Every step counts.`;
}

export function greeting(name: string | undefined, part: 'morning' | 'afternoon' | 'evening'): string {
  const who = name ? `, ${name}` : '';
  return part === 'morning' ? `Good morning${who}` : part === 'afternoon' ? `Hello${who}` : `Good evening${who}`;
}

export function streakLine(days: number): string | null {
  if (days < 2) return null;
  return `You’ve checked in ${days} days in a row. Lovely.`;
}

export const permissionCopy = {
  camera: {
    title: 'Share a moment?',
    body: 'Together uses your camera only when you choose to take a photo. Nothing is sent until you tap send.',
  },
  photos: {
    title: 'Pick a photo?',
    body: 'Together only sees the photos you choose. Nothing is shared until you send it or add it to a shared space.',
  },
  microphone: {
    title: 'Record your voice?',
    body: 'Together uses your microphone only while you hold to record. Vent recordings never leave this phone.',
  },
  notifications: {
    title: 'Hear from each other?',
    body: 'Get a gentle nudge when a hug or love note arrives. You can pause all notifications with one tap, any time.',
  },
  denied: 'No problem. You can turn this on later in your phone’s settings.',
} as const;
