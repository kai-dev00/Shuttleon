import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { CloudOff, RefreshCw, UserRound } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useAccountActions } from "@/src/account/useAccountActions";
import { useAuth } from "@/src/auth/AuthProvider";
import { formatBackupCode } from "@/src/backup/code";
import { getBackupMeta, type BackupMeta } from "@/src/backup/guestBackup";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { useSync, type SyncStatus } from "@/src/sync/SyncProvider";
import { formatListDate } from "../common/dates";
import Header from "../common/header";
import { FormError } from "./components/AuthScreenLayout";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

function syncLabel(status: SyncStatus, pending: number) {
  if (status === "syncing") return "Syncing…";
  if (status === "offline") return "Offline. Changes will sync when you're back online.";
  if (status === "error") return "Last sync failed.";
  if (pending > 0) return `${pending} change${pending === 1 ? "" : "s"} waiting to sync.`;
  return status === "synced" ? "Everything is backed up." : "Waiting to sync.";
}

export default function AccountScreen() {
  const { user, isGuest, isLoading, isConfigured } = useAuth();
  const { primaryForeground, mutedForeground, foreground } = useThemeColors();
  const { status, error: syncError, lastSyncedAt, pending, syncNow } = useSync();
  const { signOutAndWipe, leaveGuestAndWipe, backUp, hasUnbacked, hasData } = useAccountActions();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [backup, setBackup] = useState<BackupMeta>(null);
  const [unbacked, setUnbacked] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshBackup = useCallback(async () => {
    setBackup(await getBackupMeta());
    setUnbacked(await hasUnbacked());
  }, [hasUnbacked]);

  useFocusEffect(
    useCallback(() => {
      if (isGuest) void refreshBackup();
    }, [isGuest, refreshBackup]),
  );

  async function runBackup() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setBackup(await backUp());
      setUnbacked(false);
      setNotice("Backup saved. Keep your code somewhere safe.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't back up your data.");
    } finally {
      setBusy(false);
    }
  }

  function shareCode() {
    if (!backup) return;
    void Share.share({ message: `My Cockers backup code: ${formatBackupCode(backup.code)}` });
  }

  function confirmSignOut() {
    const unsynced = pending > 0;

    Alert.alert(
      unsynced ? "Unsynced changes" : "Sign out?",
      unsynced
        ? `${pending} change${pending === 1 ? "" : "s"} haven't synced yet. If you sign out now they will be lost.`
        : "Your matches are saved to your account. They'll be removed from this phone and download again when you sign back in.",
      [
        { text: "Cancel", style: "cancel" },
        ...(unsynced ? [{ text: "Sync now", onPress: () => void syncNow() }] : []),
        {
          text: unsynced ? "Sign out anyway" : "Sign out",
          style: "destructive" as const,
          onPress: async () => {
            const result = await signOutAndWipe();
            if (result.error) setError(result.error);
          },
        },
      ],
    );
  }

  async function confirmLeaveGuest() {
    const leave = () => void leaveGuestAndWipe();

    if (!(await hasData())) {
      leave();
      return;
    }

    if (!(await hasUnbacked())) {
      Alert.alert(
        "Leave guest mode?",
        "Your data will be removed from this phone. You can bring it back with your backup code, so make sure you've saved it.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: leave },
        ],
      );
      return;
    }

    Alert.alert(
      "Your data isn't backed up",
      backup
        ? "You've made changes since your last backup. If you leave now, those changes will be deleted for good."
        : "Your matches only exist on this phone. If you leave guest mode they will be deleted for good.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Back up first", onPress: () => void runBackup() },
        { text: "Delete and leave", style: "destructive", onPress: leave },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Header title="Profile" />

      <View className="gap-4 px-4 pt-2">
        {isLoading ? null : user ? (
          <>
            <Card className="flex-row items-center gap-3 p-4">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
                <UserRound size={22} color={primaryForeground} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold uppercase text-muted-foreground">Signed in</Text>
                <Text className="text-base font-semibold" numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </Card>

            <Card className="gap-3 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold">Sync</Text>
                {lastSyncedAt ? (
                  <Text className="text-xs text-muted-foreground">Last synced {formatListDate(lastSyncedAt)}</Text>
                ) : null}
              </View>
              <Text className="text-sm text-muted-foreground">{syncLabel(status, pending)}</Text>
              <FormError message={status === "error" ? syncError : null} />
              <Button
                variant="outline"
                className="h-10"
                disabled={status === "syncing"}
                onPress={() => void syncNow()}
              >
                <RefreshCw size={16} color={foreground} />
                <Text className="font-bold">Sync now</Text>
              </Button>
            </Card>

            <FormError message={error} />

            <Button variant="outline" className="h-11" onPress={confirmSignOut}>
              <Text className="font-bold">Sign out</Text>
            </Button>
          </>
        ) : isGuest ? (
          <>
            <Card className="items-center gap-2 p-5">
              <CloudOff size={28} color={mutedForeground} />
              <Text className="text-base font-semibold">You're using Cockers as a guest</Text>
              <Text className="text-center text-sm text-muted-foreground">
                Your matches are saved on this phone only. Create an account to keep them online and use them on
                other devices. Everything you've added so far will be uploaded.
              </Text>
            </Card>

            <Card className="gap-3 p-4">
              <Text className="text-sm font-semibold">Back up your data</Text>

              {backup ? (
                <>
                  <Pressable onPress={shareCode} accessibilityRole="button" accessibilityLabel="Share backup code">
                    <Text className="text-xs font-semibold uppercase text-muted-foreground">Your backup code</Text>
                    <Text
                      selectable
                      className="mt-1 text-xl font-bold"
                      style={{ fontFamily: MONO, letterSpacing: 1.5 }}
                    >
                      {formatBackupCode(backup.code)}
                    </Text>
                  </Pressable>
                  <Text className="text-xs text-muted-foreground">
                    Last backed up {formatListDate(backup.at)}.{" "}
                    {unbacked ? "You have changes since then." : "Nothing new since."} Keep this code private. Anyone
                    with it can restore your data.
                  </Text>
                </>
              ) : (
                <Text className="text-sm text-muted-foreground">
                  Save your matches under a code so you can get them back on a new phone, or after reinstalling.
                </Text>
              )}

              {notice ? <Text className="text-sm text-muted-foreground">{notice}</Text> : null}
              <FormError message={error} />

              <View className="gap-2">
                <Button className="h-10" disabled={busy} onPress={() => void runBackup()}>
                  <Text className="font-bold">
                    {busy ? "Backing up…" : backup ? "Back up now" : "Create backup code"}
                  </Text>
                </Button>
                {backup ? (
                  <Button variant="outline" className="h-10" onPress={shareCode}>
                    <Text className="font-bold">Share code</Text>
                  </Button>
                ) : null}
                <Button variant="ghost" className="h-9" onPress={() => router.push("/auth/restore")}>
                  <Text className="text-sm text-muted-foreground">Restore from a code</Text>
                </Button>
              </View>
            </Card>

            <Button className="h-11" disabled={!isConfigured} onPress={() => router.push("/auth/register")}>
              <Text className="font-bold">Create account</Text>
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={!isConfigured}
              onPress={() => router.push("/auth/login")}
            >
              <Text className="font-bold">Sign in</Text>
            </Button>
            <Button variant="ghost" className="h-11" onPress={() => void confirmLeaveGuest()}>
              <Text className="font-semibold text-destructive">Leave guest mode</Text>
            </Button>
          </>
        ) : (
          <Card className="items-center gap-2 p-5">
            <CloudOff size={28} color={mutedForeground} />
            <Text className="text-base font-semibold">You're not signed in</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Online features aren't set up for this build. Your matches are saved on this device.
            </Text>
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}
