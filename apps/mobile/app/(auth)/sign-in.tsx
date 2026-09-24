import { useState } from "react";
import { useRouter } from "expo-router";
import { isValidEmail } from "@heft/shared";
import { Button, ErrorText, Field, Screen } from "../../src/components/ui";
import { errorText } from "../../src/lib/invoke";
import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";

export default function SignIn() {
  const router = useRouter();
  const refreshProfile = useSession((state) => state.refreshProfile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!isValidEmail(email) || password.length < 8) {
      setError("Enter the email and password for this account. Passwords are at least 8 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) throw signError;
      await refreshProfile();
      router.replace("/");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="Sign in" back>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Signing in" : "Sign in"} disabled={pending} onPress={submit} />
    </Screen>
  );
}
