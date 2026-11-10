import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ChevronRight, Eye, HardDrive, Lock, LogOut, Trash, Unlink } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { Sheet, useFeedback } from '@/components/feedback';
import { PinSetup } from '@/components/overlays';
import { Button, Card, Chip, Field, Gap, Row, Screen, SectionTitle, T, ToggleRow, useInputStyle } from '@/components/ui';
import { deleteMyAccount } from '@/lib/account';
import { gentleError } from '@/lib/copy';
import { auth, db } from '@/lib/firebase';
import { useLock } from '@/lib/lock';
import { registerForPush, setNotificationsPaused } from '@/lib/notifications';
import { unpair } from '@/lib/pairing';
import { useSession } from '@/lib/session';
import { LOVE_LANGUAGES } from '@/lib/suggestions';
import { space, useTheme } from '@/theme';

export default function Settings() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, profile, partnerName, status, couple } = useSession();
  const myLanguages = (uid && couple?.loveLanguages?.[uid]) || [];
  const lock = useLock();
  const { toast, ensurePermission } = useFeedback();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [settingPin, setSettingPin] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    if (!uid || !password) return;
    setDeleting(true);
    const result = await deleteMyAccount({ uid, cid, password });
    setDeleting(false);
    if (result === 'deleted') return; // signed out; the app returns to the welcome screen
    toast(result === 'wrong-password' ? 'That password didn’t match. Could you try again?' : gentleError.save);
  }

  async function saveName() {
    if (!uid || !name.trim() || name.trim() === profile?.displayName) return;
    try {
      await updateDoc(doc(db, 'users', uid), { displayName: name.trim() });
      if (cid) await updateDoc(doc(db, 'couples', cid), { [`names.${uid}`]: name.trim() });
      toast('Saved.');
    } catch {
      toast(gentleError.save);
    }
  }

  async function enablePush() {
    if (!uid) return;
    if (!(await ensurePermission('notifications'))) return;
    const ok = await registerForPush(uid).catch(() => false);
    toast(ok ? 'You’ll get a gentle nudge when love arrives.' : 'Notifications aren’t available on this device yet.');
  }

  return (
    <Screen edges={['bottom']}>
      <SectionTitle>You</SectionTitle>
      <Card>
        <Field label="Your name" helper={status === 'paired' ? `This is how ${partnerName} sees you.` : undefined}>
          <TextInput value={name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} maxLength={60} style={input} />
        </Field>
      </Card>

      {status === 'paired' ? (
        <>
          <Gap />
          <Pressable accessibilityRole="button" onPress={() => router.push('/privacy')}>
            <Card>
              <Row>
                <Eye color={c.primary} size={22} />
                <T variant="bodyStrong" style={{ flex: 1 }}>
                  What {partnerName} can see
                </T>
                <ChevronRight color={c.textMuted} size={20} />
              </Row>
            </Card>
          </Pressable>
        </>
      ) : null}

      {status === 'paired' && cid && uid ? (
        <>
          <Gap />
          <SectionTitle>How you like to be cared for</SectionTitle>
          <Card>
            <T muted>Pick up to two. {partnerName}&apos;s support ideas will lean this way.</T>
            <Gap h={space.md} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {LOVE_LANGUAGES.map((l) => {
                const idx = myLanguages.indexOf(l.key);
                return (
                  <Chip
                    key={l.key}
                    testID={`ll-${l.key}`}
                    label={idx >= 0 ? `${idx + 1}. ${l.label}` : l.label}
                    selected={idx >= 0}
                    onPress={() => {
                      const next = idx >= 0 ? myLanguages.filter((x) => x !== l.key) : [...myLanguages, l.key].slice(-2);
                      updateDoc(doc(db, 'couples', cid), { [`loveLanguages.${uid}`]: next }).catch(() => toast(gentleError.save));
                    }}
                  />
                );
              })}
            </View>
            {myLanguages.length ? (
              <T variant="small" muted style={{ marginTop: space.sm }}>
                {LOVE_LANGUAGES.find((l) => l.key === myLanguages[0])?.detail}
              </T>
            ) : null}
          </Card>
        </>
      ) : null}

      <Gap />
      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <ToggleRow
          title="Pause all notifications"
          detail="One tap for quiet. Nothing is lost; it'll all be here when you're ready."
          value={!!profile?.notificationsPaused}
          onChange={(v) => uid && setNotificationsPaused(uid, v).catch(() => toast(gentleError.save))}
        />
        {Platform.OS !== 'web' ? <Button small kind="soft" label="Turn on hug & love note alerts" onPress={enablePush} style={{ marginTop: space.sm }} /> : null}
      </Card>

      <Gap />
      <SectionTitle>Voice notes</SectionTitle>
      <Card>
        <ToggleRow
          testID="transcribe-toggle"
          title="Transcribe my voice notes"
          detail={`Adds the words under voice notes you send, so ${status === 'paired' ? partnerName : 'your partner'} can read them in a quiet room. Never for view-once notes, vents or check-ins. Off by default.`}
          value={!!profile?.transcribeVoice}
          onChange={(v) => uid && updateDoc(doc(db, 'users', uid), { transcribeVoice: v }).catch(() => toast(gentleError.save))}
        />
      </Card>
      <Gap />
      <SectionTitle>Storage &amp; vault</SectionTitle>
      <Card>
        <Button testID="open-storage" small kind="soft" icon={HardDrive} label="Storage and free up space" onPress={() => router.push('/storage')} />
        <Gap h={space.sm} />
        <Button testID="open-vault" small kind="quiet" icon={Lock} label="My private vault" onPress={() => router.push('/vault')} />
      </Card>
      <Gap />
      <SectionTitle>App lock</SectionTitle>
      <Card>
        {!lock.supported ? (
          <T muted>App lock is available in the iPhone and Android apps.</T>
        ) : settingPin ? (
          <PinSetup
            onCancel={() => setSettingPin(false)}
            onDone={async (pin) => {
              await lock.enable(pin, lock.biometricsAvailable);
              setSettingPin(false);
              toast('Together is now locked with your PIN.');
            }}
          />
        ) : (
          <>
            <ToggleRow
              title="Lock with a PIN"
              detail="Asks for your PIN when you open Together, and after 30 seconds away."
              value={lock.settings.enabled}
              onChange={(v) => (v ? setSettingPin(true) : lock.disable())}
            />
            {lock.settings.enabled && lock.biometricsAvailable ? (
              <ToggleRow title="Use Face ID or fingerprint" value={lock.settings.biometrics} onChange={(v) => lock.setBiometrics(v)} />
            ) : null}
          </>
        )}
      </Card>

      <Gap />
      <SectionTitle>Connection</SectionTitle>
      <Card>
        {cid ? (
          <Button testID="unpair" kind="ghost" icon={Unlink} label={`Unpair from ${partnerName}`} onPress={() => setConfirmUnpair(true)} />
        ) : (
          <T muted>You&apos;re not connected with anyone right now.</T>
        )}
        <Gap h={space.sm} />
        <Button kind="ghost" icon={LogOut} label="Sign out" onPress={() => signOut(auth)} />
      </Card>

      <Gap h={space.xl} />
      <Button testID="delete-account" kind="quiet" small icon={Trash} label="Delete my account" onPress={() => setConfirmDelete(true)} />

      <Sheet
        visible={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setPassword('');
        }}>
        <T variant="title" center>
          Delete your account?
        </T>
        <Gap h={space.sm} />
        <T muted center>
          {cid
            ? `This removes everything: your private logs, your vault, and the space you share with ${partnerName}, for both of you. It can’t be undone.`
            : 'This removes everything: your private logs, your vault and your sign-in. It can’t be undone.'}
        </T>
        <Gap h={space.lg} />
        <Field label="Your password, to confirm it's you">
          <TextInput
            testID="delete-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            style={input}
          />
        </Field>
        <Gap h={space.lg} />
        <Button testID="confirm-delete-account" label="Delete everything" loading={deleting} disabled={!password} onPress={deleteAccount} />
        <Gap h={space.sm} />
        <Button
          label="Keep my account"
          kind="ghost"
          onPress={() => {
            setConfirmDelete(false);
            setPassword('');
          }}
        />
      </Sheet>

      <Sheet visible={confirmUnpair} onClose={() => setConfirmUnpair(false)}>
        <T variant="title" center>
          Unpair from {partnerName}?
        </T>
        <Gap h={space.sm} />
        <T muted center>
          You&apos;ll both stop seeing each other&apos;s shared days, notes and memories straight away. Your own private logs stay with
          you.
        </T>
        <Gap h={space.xl} />
        <Button
          label="Unpair"
          onPress={async () => {
            setConfirmUnpair(false);
            if (!cid || !uid) return;
            try {
              await unpair(cid, uid);
            } catch {
              toast(gentleError.save);
            }
          }}
        />
        <Gap h={space.sm} />
        <Button label="Stay connected" kind="ghost" onPress={() => setConfirmUnpair(false)} />
      </Sheet>
    </Screen>
  );
}
