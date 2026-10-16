import { useQueryClient } from "@tanstack/react-query";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { backUpToCloud, clearBackupMeta, getBackupMeta, restoreFromCode } from "../backup/guestBackup";
import { hasUnbackedData } from "../backup/snapshot";
import { resetLocalData } from "../sync/syncEngine";

/**
 * Actions that change what is stored on this device: signing out wipes it, guests can back it up
 * to a code and restore it from one. Must be used inside the auth, SQLite and query providers.
 */
export function useAccountActions() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { signOut, leaveGuest } = useAuth();

  /** Back to zero: all matches, sync state and the saved backup code. */
  const wipeDevice = useCallback(async () => {
    await resetLocalData(db);
    await clearBackupMeta();
    await queryClient.invalidateQueries();
  }, [db, queryClient]);

  const signOutAndWipe = useCallback(async () => {
    const result = await signOut();
    if (result.error) return result;
    await wipeDevice();
    return { error: null as string | null };
  }, [signOut, wipeDevice]);

  const leaveGuestAndWipe = useCallback(async () => {
    await wipeDevice();
    await leaveGuest();
  }, [wipeDevice, leaveGuest]);

  const backUp = useCallback(() => backUpToCloud(db), [db]);

  const restore = useCallback(
    async (code: string) => {
      await restoreFromCode(db, code);
      await queryClient.invalidateQueries();
    },
    [db, queryClient],
  );

  /** True if the device has data that the last backup (or no backup at all) doesn't cover. */
  const hasUnbacked = useCallback(async () => hasUnbackedData(db, (await getBackupMeta())?.at ?? null), [db]);

  /** True if there's any live data on the device. */
  const hasData = useCallback(() => hasUnbackedData(db, null), [db]);

  return { signOutAndWipe, leaveGuestAndWipe, backUp, restore, hasUnbacked, hasData };
}
