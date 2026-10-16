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
import {
  forgotEmailSchema,
  resetSchema,
  type ForgotEmailValues,
  type ResetValues,
} from "./authSchemas";

export default function ForgotPasswordScreen() {
  const { requestPasswordReset, resetPassword, isConfigured } = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailForm = useForm<ForgotEmailValues>({
    resolver: zodResolver(forgotEmailSchema),
    defaultValues: { email: "" },
  });
  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: "", password: "", confirmPassword: "" },
  });

  async function onRequest(values: ForgotEmailValues) {
    setError(null);
    const target = values.email.trim();
    const result = await requestPasswordReset(target);
    if (result.error) setError(result.error);
    else setEmail(target);
  }

  async function onReset(values: ResetValues) {
    if (!email) return;
    setError(null);
    const result = await resetPassword(email, values.code.trim(), values.password);
    if (result.error) setError(result.error);
  }

  async function onResend() {
    if (!email) return;
    setError(null);
    const result = await requestPasswordReset(email);
    if (result.error) setError(result.error);
    else setNotice("A new code is on its way.");
  }

  if (email) {
    return (
      <AuthScreenLayout
        key="reset"
        title="Reset password"
        subtitle={`If ${email} has an account, we sent it a code. Enter the code and choose a new password.`}
      >
        <AuthField
          control={resetForm.control}
          errors={resetForm.formState.errors}
          name="code"
          label="Code from email"
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
        />
        <AuthField
          control={resetForm.control}
          errors={resetForm.formState.errors}
          name="password"
          label="New password"
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <AuthField
          control={resetForm.control}
          errors={resetForm.formState.errors}
          name="confirmPassword"
          label="Confirm new password"
          placeholder="Repeat password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <FormError message={error} />
        {notice ? <Text className="text-sm text-muted-foreground">{notice}</Text> : null}

        <Button
          className="h-11"
          onPress={resetForm.handleSubmit(onReset)}
          disabled={resetForm.formState.isSubmitting}
        >
          <Text className="font-bold">
            {resetForm.formState.isSubmitting ? "Saving…" : "Set new password"}
          </Text>
        </Button>

        <View className="items-center gap-3 pt-2">
          <Pressable onPress={onResend} hitSlop={8}>
            <Text className="text-sm text-muted-foreground underline">Resend code</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setEmail(null);
              setError(null);
              setNotice(null);
            }}
            hitSlop={8}
          >
            <Text className="text-sm text-muted-foreground underline">Use a different email</Text>
          </Pressable>
        </View>
      </AuthScreenLayout>
    );
  }

  return (
    <AuthScreenLayout
      key="request"
      title="Forgot password"
      subtitle="Enter your account email and we'll send you a code to reset your password."
    >
      {!isConfigured ? <FormError message="Online features aren't set up for this build." /> : null}

      <AuthField
        control={emailForm.control}
        errors={emailForm.formState.errors}
        name="email"
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <FormError message={error} />

      <Button
        className="h-11"
        onPress={emailForm.handleSubmit(onRequest)}
        disabled={emailForm.formState.isSubmitting || !isConfigured}
      >
        <Text className="font-bold">
          {emailForm.formState.isSubmitting ? "Sending…" : "Send code"}
        </Text>
      </Button>

      <View className="items-center pt-2">
        <Pressable onPress={() => router.replace("/auth/login")} hitSlop={8}>
          <Text className="text-sm text-muted-foreground underline">Back to sign in</Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}
