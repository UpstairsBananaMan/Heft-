import { useState } from "react";
import { Pressable, Share, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { APP_NAME, chicagoDate } from "@heft/shared";
import { invoke } from "../lib/invoke";
import { supabase } from "../lib/supabase";
import { haptic } from "../lib/haptics";
import { useSession } from "../store/session";
import { C, font, OutlineButton } from "./v2";

type Invite = { status: string; name?: string; partnership_id?: string; auto_accept?: boolean };
type Recent = {
  id: string;
  lead_id?: string;
  partner_id: string;
  status: string;
  shift_date?: string;
  partner_first_name?: string | null;
  phone?: string | null;
};

export function PartnerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useSession((state) => state.profile);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const today = chicagoDate();
  const history = useQuery({
    queryKey: ["partner-history", profile?.id, open],
    enabled: open && Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_partnerships");
      if (error) throw error;
      return ((data ?? []) as Recent[]).filter((row) => row.lead_id === profile!.id);
    },
  });
  if (!open) return null;
  const rows = history.data ?? [];
  const accepted = rows.find((row) => row.status === "accepted" && String(row.shift_date).slice(0, 10) === today);
  const seen = new Set<string>();
  const recent = rows.filter((row) => {
    if (!row.partner_id || row.partner_id === accepted?.partner_id || seen.has(row.partner_id)) return false;
    seen.add(row.partner_id);
    return Boolean(row.partner_first_name);
  });

  async function reinvite(partnerId: string) {
    setPending(true);
    setNote("");
    const { data, error } = await supabase.rpc("reinvite_partner", { p_partner_id: partnerId });
    setPending(false);
    if (error) {
      setNote(error.message);
      return;
    }
    noteInvite(data as Invite);
  }

  function noteInvite(result: Invite) {
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
    if (result.status === "invited" && result.partnership_id) {
      void invoke("notify", { partnership_id: result.partnership_id }).catch(() => undefined);
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

  async function invite(number: string) {
    setPending(true);
    setNote("");
    const { data, error } = await supabase.rpc("invite_partner", { phone: number });
    setPending(false);
    if (error) {
      setNote(error.message);
      return;
    }
    noteInvite(data as Invite);
  }

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, backgroundColor: "rgba(26,29,33,0.35)", justifyContent: "flex-end" }}>
      <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
        <Text style={{ fontFamily: font.heading, fontSize: 24 }}>Who's with you today?</Text>
        {recent.map((row) => (
          <Pressable
            key={row.partner_id}
            accessibilityRole="button"
            accessibilityLabel={row.partner_first_name ?? "Recent partner"}
            onPress={() => {
              haptic.select();
              const digits = String(row.phone ?? "").replace(/\D/g, "");
              if (digits.length >= 10) void invite(digits);
              else void reinvite(row.partner_id);
            }}
            style={{ minHeight: 56, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: C.sand200 }}
          >
            <Text style={{ fontFamily: font.semi, fontSize: 16 }}>{row.partner_first_name}</Text>
          </Pressable>
        ))}
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
        <Pressable accessibilityRole="button" disabled={pending} onPress={() => { haptic.select(); void invite(phone); }} style={{ marginTop: 16, minHeight: 52, borderRadius: 999, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.paper, fontFamily: font.bold, fontSize: 16 }}>{pending ? "Sending…" : "Add partner"}</Text>
        </Pressable>
        {accepted ? (
          <View style={{ marginTop: 10 }}>
            <OutlineButton label="End partner for today" onPress={() => void supabase.rpc("end_partnership").then(({ error }) => {
              if (error) {
                setNote(error.message);
                return;
              }
              onClose();
            })} />
          </View>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}
