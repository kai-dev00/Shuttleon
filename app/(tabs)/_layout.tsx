import { Tabs } from "expo-router";
import { View } from "react-native";
import { House, Trophy, UserRound, Zap, type LucideIcon } from "lucide-react-native";
import { useThemeColors } from "@/src/hooks/useThemeColors";

function TabIcon({
  icon: IconComponent,
  focused,
  color,
  size,
}: {
  icon: LucideIcon;
  focused: boolean;
  color: string;
  size: number;
}) {
  const { primary, primaryForeground } = useThemeColors();

  return (
    <View
      className="h-8 w-14 items-center justify-center rounded-full"
      style={{ backgroundColor: focused ? primary : "transparent" }}
    >
      <IconComponent size={size - 2} color={focused ? primaryForeground : color} />
    </View>
  );
}

export default function TabsLayout() {
  const { foreground, mutedForeground, card, border, background } = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: background },
        tabBarActiveTintColor: foreground,
        tabBarInactiveTintColor: mutedForeground,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: card,
          borderTopColor: border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ size, color, focused }) => (
            <TabIcon icon={House} focused={focused} color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="tournament"
        options={{
          popToTopOnBlur: true,
          title: "Tournament",
          tabBarIcon: ({ size, color, focused }) => (
            <TabIcon icon={Trophy} focused={focused} color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="quick"
        options={{
          popToTopOnBlur: true,
          title: "Quick",
          tabBarIcon: ({ size, color, focused }) => (
            <TabIcon icon={Zap} focused={focused} color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          tabBarIcon: ({ size, color, focused }) => (
            <TabIcon icon={UserRound} focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
