import { useState } from "react";
import { Pressable, Share, Text, TextInput, View } from "react-native";
import { APP_NAME } from "@heft/shared";
import { supabase } from "../lib/supabase";
import { haptic } from "../lib/haptics";
import { C, font, OutlineButton } from "./v2";

type Invite = { status: string; name?: string; partnership_id?: string; auto_accept?: boolean };

export function PartnerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  if (!open) return null;

  async function invite() {
    setPending(true);
    setNote("");
    const { data, error } = await supabase.rpc("invite_partner", { phone });
    setPending(false);
    if (error) {
      setNote(error.message);
      return;
    }
    const result = data as Invite;
    if (result.status === "no_account") {
      setNote("No approved driver with that number. Send them the sign-up link.");
      return;
    }
    if (result.status === "pending_approval") {
      setNote(`${result.name ?? "They"} is still being approved. You'll see 2-person jobs once they're approved.`);
      return;
    }
    if (result.status === "no_payouts") {
      setNote(`${result.name ?? "They"} needs to set up payouts first. We've sent them a reminder.`);
      return;
    }
    if (result.status === "invited" && result.auto_accept && result.partnership_id) {
      setNote(`Waiting for ${result.name ?? "them"} to accept`);
      setTimeout(() => {
        void supabase.rpc("respond_partner", { p_id: result.partnership_id, p_accept: true }).then(() => {
          haptic.success();
          onClose();
        });
      }, 2000);
      return;
    }
    setNote(result.status === "invited" ? `Waiting for ${result.name ?? "them"} to accept` : "Couldn't add that partner.");
  }

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, backgroundColor: "rgba(26,29,33,0.35)", justifyContent: "flex-end" }}>
      <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
        <Text style={{ fontFamily: font.heading, fontSize: 24 }}>Who's with you today?</Text>
        <TextInput
          accessibilityLabel="Partner phone number"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          placeholderTextColor={C.steel500}
          style={{ marginTop: 16, minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: C.sand600, paddingHorizontal: 12, fontSize: 16, fontFamily: font.body, backgroundColor: C.white }}
        />
        {note ? <Text style={{ marginTop: 12, fontFamily: font.body, fontSize: 16 }}>{note}</Text> : null}
        {note.startsWith("No approved") ? (
          <View style={{ marginTop: 12 }}>
            <OutlineButton label="Share sign-up link" onPress={() => void Share.share({ message: `Drive with ${APP_NAME}` })} />
          </View>
        ) : null}
        <Pressable accessibilityRole="button" disabled={pending} onPress={() => { haptic.select(); void invite(); }} style={{ marginTop: 16, minHeight: 52, borderRadius: 999, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.paper, fontFamily: font.bold, fontSize: 16 }}>{pending ? "Sending…" : "Add partner"}</Text>
        </Pressable>
        <View style={{ marginTop: 10 }}>
          <OutlineButton label="End partner for today" onPress={() => void supabase.rpc("end_partnership").then(() => onClose())} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}
