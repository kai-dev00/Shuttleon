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
import { codeSchema, registerSchema, type CodeValues, type RegisterValues } from "./authSchemas";

export default function RegisterScreen() {
  const { signUp, confirmSignUp, resendSignUpCode, isConfigured } = useAuth();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const register = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });
  const verify = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  async function onRegister(values: RegisterValues) {
    setError(null);
    const email = values.email.trim();
    const result = await signUp(email, values.password);
    if (result.error) return setError(result.error);

    if (result.needsConfirmation) setPendingEmail(email);
  }

  async function onVerify(values: CodeValues) {
    if (!pendingEmail) return;
    setError(null);
    const result = await confirmSignUp(pendingEmail, values.code.trim());
    if (result.error) setError(result.error);
  }

  async function onResend() {
    if (!pendingEmail) return;
    setError(null);
    const result = await resendSignUpCode(pendingEmail);
    if (result.error) setError(result.error);
    else setNotice("A new code is on its way.");
  }

  if (pendingEmail) {
    return (
      <AuthScreenLayout
        key="verify"
        title="Verify email"
        subtitle={`We sent a code to ${pendingEmail}. Enter it below to finish creating your account.`}
      >
        <AuthField
          control={verify.control}
          errors={verify.formState.errors}
          name="code"
          label="Verification code"
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
        />

        <FormError message={error} />
        {notice ? <Text className="text-sm text-muted-foreground">{notice}</Text> : null}

        <Button
          className="h-11"
          onPress={verify.handleSubmit(onVerify)}
          disabled={verify.formState.isSubmitting}
        >
          <Text className="font-bold">{verify.formState.isSubmitting ? "Verifying…" : "Verify"}</Text>
        </Button>

        <View className="items-center gap-3 pt-2">
          <Pressable onPress={onResend} hitSlop={8}>
            <Text className="text-sm text-muted-foreground underline">Resend code</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setPendingEmail(null);
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

  const { control, handleSubmit, formState } = register;

  return (
    <AuthScreenLayout
      key="register"
      title="Create account"
      subtitle="Your matches are saved on this device and sync once you're signed in."
    >
      {!isConfigured ? <FormError message="Online features aren't set up for this build." /> : null}

      <AuthField
        control={control}
        errors={formState.errors}
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
        errors={formState.errors}
        name="password"
        label="Password"
        placeholder="At least 6 characters"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <AuthField
        control={control}
        errors={formState.errors}
        name="confirmPassword"
        label="Confirm password"
        placeholder="Repeat password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <FormError message={error} />

      <Button
        className="h-11"
        onPress={handleSubmit(onRegister)}
        disabled={formState.isSubmitting || !isConfigured}
      >
        <Text className="font-bold">
          {formState.isSubmitting ? "Creating account…" : "Create account"}
        </Text>
      </Button>

      <View className="items-center pt-2">
        <Pressable onPress={() => router.replace("/auth/login")} hitSlop={8}>
          <Text className="text-sm">
            Already have an account? <Text className="text-sm font-bold underline">Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}
