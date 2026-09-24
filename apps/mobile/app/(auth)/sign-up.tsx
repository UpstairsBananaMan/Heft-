import { useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { isValidEmail, isValidPhone, publicSignupRole, type Role } from "@heft/shared";
import { Button, Choice, ErrorText, Field, Notice, Screen } from "../../src/components/ui";
import { track } from "../../src/lib/analytics";
import { authRedirectUrl } from "../../src/lib/auth-link";
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
    const signupRole = publicSignupRole(role);
    if (name.trim().length < 2) {
      setError("Enter the name customers or dispatch should see.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a real email address. You will use it to sign in.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Enter a phone number with at least 10 digits.");
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
          emailRedirectTo: authRedirectUrl(),
          data: { role: signupRole, display_name: name.trim(), phone: phone.trim() },
        },
      });
      if (signError) throw signError;
      if (!data.session) {
        setError("Check email to confirm the account, then sign in. The link opens the app.");
        return;
      }
      await refreshProfile();
      track({ name: "signup_completed", role: signupRole });
      router.replace(signupRole === "driver" ? "/(driver)/setup" : "/");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="Create account" back>
      <Notice>Admin is not a choice here. Choosing admin, or sending it another way, still creates a customer. Admin is a separate step on the website.</Notice>
      <Choice
        label="Role"
        value={role}
        onChange={(value) => setRole(publicSignupRole(value) as Exclude<Role, "admin">)}
        options={[
          { value: "customer", label: "Customer" },
          { value: "driver", label: "Driver" },
        ]}
      />
      {role === "driver" ? (
        <Text className="mb-4 text-sm leading-5 text-steel">
          After this you add a vehicle. You stay pending until an admin approves you. Pending drivers cannot go online or accept jobs.
        </Text>
      ) : (
        <Text className="mb-4 text-sm leading-5 text-steel">
          Name, email, phone, and password are all required. You will see a price before a driver is dispatched.
        </Text>
      )}
      <Field label="Display name" value={name} onChangeText={setName} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="850 555 0100" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Creating" : "Create account"} disabled={pending} onPress={() => void submit()} />
    </Screen>
  );
}
