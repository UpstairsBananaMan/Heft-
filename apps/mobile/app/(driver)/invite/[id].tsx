import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../src/lib/supabase";
import { haptic } from "../../../src/lib/haptics";
import { C, font, OutlineButton, PrimaryButton } from "../../../src/components/v2";

type InviteRow = { id: string; status: string; lead_first_name?: string | null };

export default function PartnerInvite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const invite = useQuery({
    queryKey: ["partner-invite", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.rpc("partnership_detail", { p_id: id });
      if (queryError) throw queryError;
      return (data ?? null) as InviteRow | null;
    },
  });
  const row = invite.data;
  const lead = row?.lead_first_name?.split(" ")[0] || "A driver";

  async function respond(accept: boolean) {
    if (!id) return;
    setPending(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("respond_partner", { p_id: id, p_accept: accept });
    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (accept) haptic.success();
    else haptic.light();
    await queryClient.invalidateQueries();
    router.replace("/(driver)/map");
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, padding: 20, paddingTop: 72 }}>
      <Text style={{ fontFamily: font.heading, fontSize: 28 }}>{lead} added you as their partner today.</Text>
      <Text style={{ fontFamily: font.body, fontSize: 16, color: C.steel, marginTop: 12 }}>Your share is paid to you directly.</Text>
      {row && row.status !== "pending" ? (
        <Text style={{ marginTop: 16, fontFamily: font.body, fontSize: 16 }}>This invite is no longer open.</Text>
      ) : (
        <View style={{ marginTop: 24, gap: 10 }}>
          <PrimaryButton label={pending ? "Sending…" : "Accept"} disabled={pending} onPress={() => void respond(true)} />
          <OutlineButton label="Not today" onPress={() => void respond(false)} />
        </View>
      )}
      {error ? <Text style={{ color: C.red, marginTop: 12, fontFamily: font.body }}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: "center", marginTop: 12 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Back</Text>
      </Pressable>
    </View>
  );
}
