import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useSQLiteContext } from "expo-sqlite";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { supabaseRemote } from "./supabaseRemote";
import {
  countPending,
  getLastSyncedAt,
  getLastUserId,
  resetLocalData,
  setLastUserId,
  syncOnce,
} from "./syncEngine";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

type SyncContextValue = {
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: string | null;
  /** Local changes not uploaded yet. */
  pending: number;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const WRITE_DEBOUNCE_MS = 2000;
const POLL_MS = 60_000;

/**
 * Keeps the local SQLite database and Supabase in step while a user is signed in:
 * on sign-in, app foreground, reconnect, after local writes, and on a slow poll.
 * Signed out (or no Supabase config) it does nothing and the app stays local-only.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { user, isConfigured } = useAuth();
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  const running = useRef(false);
  const rerun = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPending = useCallback(async () => {
    setPending(await countPending(db));
  }, [db]);

  /**
   * Makes this device belong to the signed-in user. Data made before signing in (as a guest) is kept
   * and uploaded. Leftovers from a different account are cleared without asking: signing out already
   * wipes the device, so this only happens if that was interrupted.
   */
  const claimDevice = useCallback(
    async (id: string) => {
      const owner = await getLastUserId(db);
      if (owner === id) return;

      if (owner !== null) {
        await resetLocalData(db);
        await queryClient.invalidateQueries();
      }
      await setLastUserId(db, id);
    },
    [db, queryClient],
  );

  const syncNow = useCallback(async () => {
    if (!isConfigured || !userId) return;
    if (running.current) {
      rerun.current = true;
      return;
    }

    running.current = true;
    setStatus("syncing");
    setError(null);

    try {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        setStatus("offline");
        return;
      }

      await claimDevice(userId);

      const result = await syncOnce(db, supabaseRemote);
      if (result.pulled > 0) await queryClient.invalidateQueries();

      setLastSyncedAt(await getLastSyncedAt(db));
      setStatus("synced");
    } catch (e) {
      const net = await NetInfo.fetch().catch(() => null);
      if (net?.isConnected === false) {
        setStatus("offline");
      } else {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Sync failed");
      }
    } finally {
      running.current = false;
      await refreshPending().catch(() => undefined);
      if (rerun.current) {
        rerun.current = false;
        void syncNow();
      }
    }
  }, [isConfigured, userId, db, claimDevice, queryClient, refreshPending]);

  // Latest syncNow for long-lived listeners.
  const syncRef = useRef(syncNow);
  syncRef.current = syncNow;

  // Sync when a user signs in; reset the display when they sign out.
  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      setError(null);
      return;
    }
    void syncRef.current();
  }, [userId]);

  // Show the saved last-sync time and pending count even before the first sync finishes.
  useEffect(() => {
    getLastSyncedAt(db).then(setLastSyncedAt).catch(() => undefined);
    void refreshPending().catch(() => undefined);
  }, [db, refreshPending]);

  useEffect(() => {
    if (!userId) return;

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncRef.current();
    });

    let wasOnline: boolean | null = null;
    const net = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      if (online && wasOnline === false) void syncRef.current();
      if (!online) setStatus("offline");
      wasOnline = online;
    });

    // Local writes all go through React Query mutations; sync shortly after the last one.
    const mutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        void refreshPending().catch(() => undefined);
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => void syncRef.current(), WRITE_DEBOUNCE_MS);
      }
    });

    // Pick up changes made on other devices while the app stays open.
    const poll = setInterval(() => {
      if (AppState.currentState === "active") void syncRef.current();
    }, POLL_MS);

    return () => {
      appState.remove();
      net();
      mutations();
      clearInterval(poll);
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [userId, queryClient, refreshPending]);

  const value = useMemo<SyncContextValue>(
    () => ({ status, error, lastSyncedAt, pending, syncNow }),
    [status, error, lastSyncedAt, pending, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used inside <SyncProvider>");
  return context;
}
