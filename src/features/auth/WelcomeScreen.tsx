import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CloudCheck, Trophy, Zap, type LucideIcon } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth/AuthProvider";
import { useThemeColors } from "@/src/hooks/useThemeColors";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Zap, title: "Quick matches", body: "Score a game in seconds, singles or doubles." },
  { icon: Trophy, title: "Tournaments", body: "Brackets, standings and results in one place." },
  { icon: CloudCheck, title: "Always with you", body: "Works offline and syncs across your devices." },
];

/** First screen for signed-out users. */
export default function WelcomeScreen() {
  const { primary, primaryForeground, mutedForeground } = useThemeColors();
  const { continueAsGuest } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-10 px-6">
        <View className="items-center gap-4">
          <View
            className="h-20 w-20 items-center justify-center rounded-3xl"
            style={{ backgroundColor: primary }}
          >
            <Zap size={40} color={primaryForeground} />
          </View>
          <View className="items-center gap-1">
            <Text className="text-4xl font-extrabold tracking-tight">Cockers</Text>
            <Text className="text-center text-base text-muted-foreground">
              Badminton scoring and tournaments, made simple.
            </Text>
          </View>
        </View>

        <View className="gap-5">
          {FEATURES.map(({ icon: FeatureIcon, title, body }) => (
            <View key={title} className="flex-row items-center gap-4">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
                <FeatureIcon size={20} color={mutedForeground} />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold">{title}</Text>
                <Text className="text-sm text-muted-foreground">{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="gap-3 px-6 pb-4">
        <Button className="h-12" onPress={() => router.push("/auth/register")}>
          <Text className="text-base font-bold">Create account</Text>
        </Button>
        <Button variant="outline" className="h-12" onPress={() => router.push("/auth/login")}>
          <Text className="text-base font-bold">Sign in</Text>
        </Button>
        <Button variant="ghost" className="h-12" onPress={() => void continueAsGuest()}>
          <Text className="text-base font-semibold text-muted-foreground">Continue as guest</Text>
        </Button>
        <Button variant="link" className="h-9" onPress={() => router.push("/auth/restore")}>
          <Text className="text-sm text-muted-foreground">Restore from a backup code</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
