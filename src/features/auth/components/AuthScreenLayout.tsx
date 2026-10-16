import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import Header from "@/src/features/common/header";
import { Text } from "@/components/ui/text";

/** Shared shell for the auth screens: back header, keyboard-safe scrolling form area. */
export default function AuthScreenLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <Header title={title} showBack onBackPress={goBack} />
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-32 pt-2"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
          <View className="gap-4">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="rounded-md bg-destructive/10 px-3 py-2">
      <Text className="text-sm text-destructive">{message}</Text>
    </View>
  );
}
