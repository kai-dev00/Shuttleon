import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SQLiteDatabase } from "expo-sqlite";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { generateBackupCode, normalizeBackupCode } from "./code";
import { createSnapshot, restoreSnapshot } from "./snapshot";

const CODE_KEY = "cockers-backup-code";
const AT_KEY = "cockers-backup-at";
// The server rejects payloads over 5 MB; fail early with a clear message instead.
const MAX_PAYLOAD_CHARS = 4_500_000;

export type BackupMeta = { code: string; at: string } | null;

/** The code and time of this device's last backup (saved on the device so "Back up now" reuses the code). */
export async function getBackupMeta(): Promise<BackupMeta> {
  try {
    const [code, at] = await Promise.all([AsyncStorage.getItem(CODE_KEY), AsyncStorage.getItem(AT_KEY)]);
    return code && at ? { code, at } : null;
  } catch {
    return null;
  }
}

async function setBackupMeta(code: string, at: string) {
  await AsyncStorage.multiSet([
    [CODE_KEY, code],
    [AT_KEY, at],
  ]);
}

export async function clearBackupMeta() {
  try {
    await AsyncStorage.multiRemove([CODE_KEY, AT_KEY]);
  } catch {
    // Nothing useful to do; the worst case is a stale "last backed up" line.
  }
}

function friendlyError(message: string) {
  if (/network|fetch|timeout|failed to connect/i.test(message)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (/too large/i.test(message)) return "Your data is too large to back up.";
  return message;
}

function assertOnline() {
  if (!isSupabaseConfigured) throw new Error("Online features aren't set up for this build.");
}

/** Uploads a snapshot under this device's backup code, creating the code on the first backup. */
export async function backUpToCloud(db: SQLiteDatabase) {
  assertOnline();

  const existing = await getBackupMeta();
  const code = existing?.code ?? generateBackupCode();
  const snapshot = await createSnapshot(db);

  if (JSON.stringify(snapshot).length > MAX_PAYLOAD_CHARS) {
    throw new Error("Your data is too large to back up.");
  }

  const { error } = await supabase.rpc("save_guest_backup", { p_code: code, p_payload: snapshot });
  if (error) throw new Error(friendlyError(error.message));

  await setBackupMeta(code, snapshot.createdAt);
  return { code, at: snapshot.createdAt };
}

/** Replaces everything on this device with the backup stored under `input`. */
export async function restoreFromCode(db: SQLiteDatabase, input: string) {
  assertOnline();

  const code = normalizeBackupCode(input);
  if (!code) throw new Error("That code isn't valid. Check it and try again.");

  const { data, error } = await supabase.rpc("load_guest_backup", { p_code: code });
  if (error) throw new Error(friendlyError(error.message));
  if (!data) throw new Error("No backup found for that code.");

  await restoreSnapshot(db, data);
  await setBackupMeta(code, new Date().toISOString());
}
