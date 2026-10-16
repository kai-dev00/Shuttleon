import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAccountActions } from "@/src/account/useAccountActions";
import { useAuth } from "@/src/auth/AuthProvider";
import AuthField from "./components/AuthField";
import AuthScreenLayout, { FormError } from "./components/AuthScreenLayout";
import { restoreSchema, type RestoreValues } from "./authSchemas";

/** Brings a guest's backup back onto this device using the backup code. */
export default function RestoreScreen() {
  const { isGuest, isConfigured, continueAsGuest } = useAuth();
  const { restore, hasData } = useAccountActions();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RestoreValues>({
    resolver: zodResolver(restoreSchema),
    defaultValues: { code: "" },
  });

  async function run(code: string) {
    try {
      await restore(code);
      await continueAsGuest();
      // Let the guest flag reach the router's gate before navigating into the app.
      await new Promise((resolve) => setTimeout(resolve, 50));
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't restore that backup.");
    }
  }

  async function onSubmit(values: RestoreValues) {
    setError(null);

    // Restoring replaces what's on the phone now, so check before overwriting real data.
    if (isGuest && (await hasData())) {
      Alert.alert(
        "Replace the data on this phone?",
        "Restoring deletes the matches and tournaments currently on this phone and replaces them with the backup.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", style: "destructive", onPress: () => void run(values.code) },
        ],
      );
      return;
    }

    await run(values.code);
  }

  return (
    <AuthScreenLayout
      title="Restore backup"
      subtitle="Enter the backup code you saved. Your matches and tournaments will come back to this phone."
    >
      {!isConfigured ? <FormError message="Online features aren't set up for this build." /> : null}

      <AuthField
        control={control}
        errors={errors}
        name="code"
        label="Backup code"
        placeholder="XXXX-XXXX-XXXX-XXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={24}
      />

      <FormError message={error} />

      <Button className="h-11" onPress={handleSubmit(onSubmit)} disabled={isSubmitting || !isConfigured}>
        <Text className="font-bold">{isSubmitting ? "Restoring…" : "Restore"}</Text>
      </Button>
    </AuthScreenLayout>
  );
}
