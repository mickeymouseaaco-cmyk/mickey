/**
 * Delete my account (required by the App Store and Google Play).
 *
 * 1. Confirm it's really you (your password), before anything is touched.
 * 2. Unpair, so the shared space and its files are removed for both of you
 *    (the onCoupleDeleted function cleans up).
 * 3. Delete the sign-in account. The onAccountDeleted function then removes
 *    your private logs, settings, vault and private files.
 */
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential } from 'firebase/auth';

import { auth } from './firebase';
import { unpair } from './pairing';

export type DeleteAccountResult = 'deleted' | 'wrong-password' | 'failed';

export async function deleteMyAccount(opts: { uid: string; cid: string | null; password: string }): Promise<DeleteAccountResult> {
  const user = auth.currentUser;
  if (!user || user.uid !== opts.uid) return 'failed';
  try {
    if (user.email) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, opts.password));
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    return code.includes('wrong-password') || code.includes('invalid-credential') || code.includes('invalid-login') ? 'wrong-password' : 'failed';
  }
  try {
    if (opts.cid) await unpair(opts.cid, opts.uid).catch(() => {});
    await deleteUser(user);
    return 'deleted';
  } catch {
    return 'failed';
  }
}
