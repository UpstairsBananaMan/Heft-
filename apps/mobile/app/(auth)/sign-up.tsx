import { useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import type { Role } from "@heft/shared";
import { Button, Choice, ErrorText, Field, Screen } from "../../src/components/ui";
import { errorText } from "../../src/lib/invoke";
import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";

export default function SignUp() {
  const router = useRouter();
  const refreshProfile = useSession((state) => state.refreshProfile);
  const [role, setRole] = useState<Exclude<Role, "admin">>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (name.trim().length < 2) {
      setError("Enter the name customers or dispatch should see.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const { data, error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { role, display_name: name.trim(), phone: phone.trim() || null },
        },
      });
      if (signError) throw signError;
      if (!data.session) {
        setError("Check email to confirm the account, then sign in. Local config skips confirmation.");
        return;
      }
      await refreshProfile();
      router.replace("/");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="Create account" back>
      <Text className="mb-4 text-sm leading-5 text-steel">Admin is not offered here. Seed that user for the web console.</Text>
      <Choice
        label="Role"
        value={role}
        onChange={(value) => setRole(value as Exclude<Role, "admin">)}
        options={[
          { value: "customer", label: "Customer" },
          { value: "driver", label: "Driver" },
        ]}
      />
      <Field label="Display name" value={name} onChangeText={setName} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Creating" : "Create account"} disabled={pending} onPress={submit} />
    </Screen>
  );
}
