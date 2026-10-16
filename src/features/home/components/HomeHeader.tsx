import { Text, View } from "react-native";

export function HomeHeader() {
  return (
    <View>
      <Text
        style={{
          fontSize: 16,
          color: "#6B7280",
        }}
      >
        Good Morning 👋
      </Text>

      <Text
        style={{
          fontSize: 34,
          fontWeight: "bold",
        }}
      >
        Cockers
      </Text>

      <Text
        style={{
          marginTop: 4,
          color: "#9CA3AF",
        }}
      >
        Date here
      </Text>
    </View>
  );
}
