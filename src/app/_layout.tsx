import { Lora_500Medium, Lora_600SemiBold } from '@expo-google-fonts/lora';
import { Raleway_500Medium, Raleway_600SemiBold, Raleway_700Bold } from '@expo-google-fonts/raleway';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CelebrateProvider } from '@/components/celebrate';
import { FeedbackProvider } from '@/components/feedback';
import { IncomingLove, LockScreen, SurpriseWatcher } from '@/components/overlays';
import { LockProvider } from '@/lib/lock';
import { configureNotifications } from '@/lib/notifications';
import { outbox } from '@/lib/outbox';
import { SessionProvider, useSession } from '@/lib/session';
import { TogetherThemeProvider, fonts, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Send people to the right place for where they are: sign in, pair, or home. */
function Gate() {
  const { status, uid } = useSession();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading') return;
    SplashScreen.hideAsync().catch(() => {});
    const first = segments[0] as string | undefined;
    if (status === 'unconfigured' && first !== 'setup') router.replace('/setup');
    else if (status === 'signedOut' && first !== 'sign-in') router.replace('/sign-in');
    else if (status === 'needsPair' && first !== 'pair' && first !== 'settings') router.replace('/pair');
    else if (status === 'paired' && (first === 'sign-in' || first === 'pair' || first === 'setup' || first === undefined)) {
      router.replace('/(tabs)');
    }
  }, [status, segments]);

  // Resume any media still waiting to send.
  useEffect(() => {
    if (!uid) return;
    outbox.load().then(() => outbox.kick(uid));
  }, [uid]);

  return null;
}

function Navigator() {
  const { c, dark } = useTheme();
  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.border,
      primary: c.primary,
      notification: c.heart,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: { fontFamily: fonts.heading, color: c.text },
          headerTintColor: c.primary,
          contentStyle: { backgroundColor: c.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="pair" options={{ title: 'Connect with your partner', headerShown: false }} />
        <Stack.Screen name="log-steps" options={{ title: 'Steps', presentation: 'modal' }} />
        <Stack.Screen name="log-mood" options={{ title: 'How are you?', presentation: 'modal' }} />
        <Stack.Screen name="vent" options={{ title: 'Vent', presentation: 'modal' }} />
        <Stack.Screen name="calm" options={{ title: 'Calm Corner' }} />
        <Stack.Screen name="cycle" options={{ title: 'Cycle' }} />
        <Stack.Screen name="check-in" options={{ title: 'Evening check-in', presentation: 'modal' }} />
        <Stack.Screen name="gratitude" options={{ title: 'Gratitude Wall' }} />
        <Stack.Screen name="mood-calendar" options={{ title: 'Our moods' }} />
        <Stack.Screen name="reset" options={{ title: 'A gentle reset' }} />
        <Stack.Screen name="storage" options={{ title: 'Storage' }} />
        <Stack.Screen name="vault" options={{ title: 'Private vault' }} />
        <Stack.Screen name="trip-new" options={{ title: 'New trip', presentation: 'modal' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="trip/slideshow" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="bucket-list" options={{ title: 'Our bucket list' }} />
        <Stack.Screen name="date-night" options={{ title: 'Date night ideas' }} />
        <Stack.Screen name="milestones" options={{ title: 'Milestones' }} />
        <Stack.Screen name="todos" options={{ title: 'Our to-dos' }} />
        <Stack.Screen name="weekend" options={{ title: 'This weekend' }} />
        <Stack.Screen name="schedule-note" options={{ title: 'Schedule a note', presentation: 'modal' }} />
        <Stack.Screen name="memory-new" options={{ title: 'New memory', presentation: 'modal' }} />
        <Stack.Screen name="memory/[id]" options={{ title: 'Memory' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="privacy" options={{ title: 'What they can see' }} />
      </Stack>
      <Gate />
      <IncomingLove />
      <SurpriseWatcher />
      <LockScreen />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Lora_500Medium, Lora_600SemiBold, Raleway_500Medium, Raleway_600SemiBold, Raleway_700Bold });

  useEffect(() => {
    configureNotifications();
  }, []);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TogetherThemeProvider>
          <SessionProvider>
            <LockProvider>
              <FeedbackProvider>
                <CelebrateProvider>
                  <Navigator />
                </CelebrateProvider>
              </FeedbackProvider>
            </LockProvider>
          </SessionProvider>
        </TogetherThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
