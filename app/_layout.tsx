import { Stack } from "expo-router";
// @ts-ignore: side-effect import for global CSS
import "../global.css";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import { ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";

import { SQLiteProvider } from "expo-sqlite";
import { migrateDbIfNeeded } from "../src//database/migrations";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { NAV_THEME, THEME } from "@/lib/theme";
import { useThemeBootstrap } from "@/src/hooks/useTheme";
import { AuthProvider, useAuth } from "@/src/auth/AuthProvider";
import { SyncProvider } from "@/src/sync/SyncProvider";

export default function RootLayout() {
  const ready = useThemeBootstrap();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";

  // Wait for the saved preference so users don't see a flash of the wrong theme.
  if (!ready) return null;

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SQLiteProvider databaseName="cockers.db" onInit={migrateDbIfNeeded}>
            <SyncProvider>
              <SafeAreaProvider>
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                <RootStack backgroundColor={THEME[scheme].background} />
                <PortalHost />
              </SafeAreaProvider>
            </SyncProvider>
          </SQLiteProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** Signed-in users and guests get the app; everyone else only sees the welcome and auth screens. */
function RootStack({ backgroundColor }: { backgroundColor: string }) {
  const { session, isGuest, isLoading, isConfigured } = useAuth();

  // Don't flash the welcome screen while the saved session is being read.
  if (isLoading) return null;

  // Without Supabase config nobody can sign in, so fall back to the local-only app.
  const canUseApp = Boolean(session) || isGuest || !isConfigured;
  // Guests can still reach the sign-in screens to create an account later.
  const canSignIn = isConfigured && !session;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      <Stack.Protected guard={canUseApp}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Protected guard={!canUseApp}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>

      <Stack.Protected guard={canSignIn}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
    </Stack>
  );
}
