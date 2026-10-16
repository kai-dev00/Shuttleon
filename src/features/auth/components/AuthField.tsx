import { useState } from "react";
import { Pressable, View, type TextInputProps } from "react-native";
import { Controller, type Control, type FieldErrors, type FieldValues, type Path } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react-native";

import { CustomInput } from "@/components/ui/CustomInput";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/src/hooks/useThemeColors";

type AuthFieldProps<T extends FieldValues> = Omit<TextInputProps, "value" | "onChangeText"> & {
  control: Control<T>;
  name: Path<T>;
  label: string;
  errors: FieldErrors<T>;
};

/**
 * react-hook-form controlled text field using the app's CustomInput.
 * Fields with `secureTextEntry` get a show/hide eye button.
 */
export default function AuthField<T extends FieldValues>({
  control,
  name,
  label,
  errors,
  ...inputProps
}: AuthFieldProps<T>) {
  const message = errors[name]?.message;
  const error = typeof message === "string" ? message : undefined;
  const { mutedForeground } = useThemeColors();
  const [revealed, setRevealed] = useState(false);

  if (!inputProps.secureTextEntry) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange, onBlur } }) => (
          <CustomInput
            {...inputProps}
            label={label}
            value={value as string}
            onChangeText={onChange}
            onBlur={onBlur}
            error={error}
          />
        )}
      />
    );
  }

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <View className="gap-1">
          <Text className="text-sm text-foreground">{label}</Text>

          <View className="relative">
            <Input
              {...inputProps}
              value={value as string}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={!revealed}
              autoCorrect={false}
              className={cn("pr-11", error && "border-destructive")}
            />
            <Pressable
              onPress={() => setRevealed((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
              hitSlop={6}
              className="absolute right-0 top-0 h-10 w-11 items-center justify-center"
            >
              {revealed ? (
                <EyeOff size={18} color={mutedForeground} />
              ) : (
                <Eye size={18} color={mutedForeground} />
              )}
            </Pressable>
          </View>

          {error ? <Text className="mt-1 text-sm text-destructive">{error}</Text> : null}
        </View>
      )}
    />
  );
}
