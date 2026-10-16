import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth/AuthProvider";
import AuthField from "./components/AuthField";
import AuthScreenLayout, { FormError } from "./components/AuthScreenLayout";
import { loginSchema, type LoginValues } from "./authSchemas";

export default function LoginScreen() {
  const { signIn, isConfigured } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    const result = await signIn(values.email.trim(), values.password);
    if (result.error) setError(result.error);
  }

  return (
    <AuthScreenLayout title="Sign in" subtitle="Sign in to back up and sync your matches across devices.">
      {!isConfigured ? <FormError message="Online features aren't set up for this build." /> : null}

      <AuthField
        control={control}
        errors={errors}
        name="email"
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <AuthField
        control={control}
        errors={errors}
        name="password"
        label="Password"
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
      />

      <FormError message={error} />

      <Button className="h-11" onPress={handleSubmit(onSubmit)} disabled={isSubmitting || !isConfigured}>
        <Text className="font-bold">{isSubmitting ? "Signing in…" : "Sign in"}</Text>
      </Button>

      <View className="items-center gap-3 pt-2">
        <Pressable onPress={() => router.push("/auth/forgot-password")} hitSlop={8}>
          <Text className="text-sm text-muted-foreground underline">Forgot password?</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/auth/register")} hitSlop={8}>
          <Text className="text-sm">
            Don't have an account? <Text className="text-sm font-bold underline">Create one</Text>
          </Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}
