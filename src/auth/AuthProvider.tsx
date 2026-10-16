import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_STORAGE_KEY, isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been read on startup. */
  isLoading: boolean;
  /** False when the Supabase env vars are missing (app runs local-only). */
  isConfigured: boolean;
  /** Using the app without an account: everything stays on this device and nothing syncs. */
  isGuest: boolean;
  continueAsGuest: () => Promise<void>;
  /** Ends guest mode. The caller is responsible for clearing the device's data. */
  leaveGuest: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** `needsConfirmation` is true when the project requires the emailed code before sign-in. */
  signUp: (email: string, password: string) => Promise<AuthResult & { needsConfirmation: boolean }>;
  confirmSignUp: (email: string, code: string) => Promise<AuthResult>;
  resendSignUpCode: (email: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  /** Verifies the emailed recovery code, then sets the new password. Leaves the user signed in. */
  resetPassword: (email: string, code: string, newPassword: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * supabase-js returns no session when the access token has expired and it can't refresh it (offline).
 * This app works offline, so fall back to the saved session; the client refreshes it once online
 * and signs the user out via onAuthStateChange if the refresh token was revoked.
 */
async function readSavedSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return saved?.user && saved?.access_token ? (saved as Session) : null;
  } catch {
    return null;
  }
}

const GUEST_KEY = "cockers-guest";

async function readGuestFlag() {
  try {
    return (await AsyncStorage.getItem(GUEST_KEY)) === "1";
  } catch {
    return false;
  }
}

const NOT_CONFIGURED = "Online features aren't set up for this build.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    Promise.all([
      supabase.auth.getSession().then(async ({ data }) => data.session ?? (await readSavedSession())),
      readGuestFlag(),
    ]).then(([restored, guest]) => {
      if (!active) return;
      setSession(restored);
      setIsGuest(guest && !restored);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        // A real account replaces guest mode.
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => undefined);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const continueAsGuest = useCallback<AuthContextValue["continueAsGuest"]>(async () => {
    try {
      await AsyncStorage.setItem(GUEST_KEY, "1");
    } catch {
      // The choice just won't survive a restart.
    }
    setIsGuest(true);
  }, []);

  const leaveGuest = useCallback<AuthContextValue["leaveGuest"]>(async () => {
    try {
      await AsyncStorage.removeItem(GUEST_KEY);
    } catch {
      // Ignore: the in-memory flag below is what the UI uses.
    }
    setIsGuest(false);
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (email, password) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async (email, password) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED, needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsConfirmation: false };

    // An existing, confirmed email returns a user with no identities and no session.
    if (data.user && data.user.identities?.length === 0) {
      return { error: "An account with this email already exists.", needsConfirmation: false };
    }

    return { error: null, needsConfirmation: !data.session };
  }, []);

  const confirmSignUp = useCallback<AuthContextValue["confirmSignUp"]>(async (email, code) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
    return { error: error?.message ?? null };
  }, []);

  const resendSignUpCode = useCallback<AuthContextValue["resendSignUpCode"]>(async (email) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error: error?.message ?? null };
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(async (email) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback<AuthContextValue["resetPassword"]>(async (email, code, newPassword) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };

    const verified = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (verified.error) return { error: verified.error.message };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback<AuthContextValue["signOut"]>(async () => {
    if (!isSupabaseConfigured) return { error: null };
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Couldn't reach the server (offline). The person still asked to sign out, so drop the saved login here.
      try {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // Ignore.
      }
      setSession(null);
    }
    return { error: null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isConfigured: isSupabaseConfigured,
      isGuest,
      continueAsGuest,
      leaveGuest,
      signIn,
      signUp,
      confirmSignUp,
      resendSignUpCode,
      requestPasswordReset,
      resetPassword,
      signOut,
    }),
    [session, isGuest, continueAsGuest, leaveGuest, isLoading, signIn, signUp, confirmSignUp, resendSignUpCode, requestPasswordReset, resetPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
