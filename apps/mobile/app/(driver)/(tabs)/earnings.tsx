import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { APP_NAME, driverKeepPercent, formatUsd } from "@heft/shared";
import { C, font, PrimaryButton } from "../../../src/components/v2";
import { supabase } from "../../../src/lib/supabase";
import { useSession } from "../../../src/store/session";
import { useRouter } from "expo-router";

type Row = { id: string; amount_cents: number; status: string; job_id: string };

export default function Earnings() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const [open, setOpen] = useState<string | null>(null);
  const payouts = useQuery({
    queryKey: ["earnings", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payouts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = payouts.data ?? [];
  const total = rows.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  const keep = driverKeepPercent();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, paddingTop: 64 }}>
      <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 14 }}>This week</Text>
      <Text style={{ fontFamily: font.display, fontSize: 44, color: C.ink }}>{formatUsd(total)}</Text>
      <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 16, marginBottom: 16 }}>{rows.length} jobs</Text>
      <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Set up payouts to get paid</Text>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton label="Set up payouts" onPress={() => router.push("/stripe/connect")} />
        </View>
      </View>
      {rows.map((row) => {
        const expanded = open === row.id;
        const customerPaid = Math.round(row.amount_cents / (keep / 100));
        const fee = customerPaid - row.amount_cents;
        return (
          <Pressable key={row.id} onPress={() => setOpen(expanded ? null : row.id)} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Delivery</Text>
              <Text style={{ fontFamily: font.heading, fontSize: 18 }}>{formatUsd(row.amount_cents)}</Text>
            </View>
            <Text style={{ color: C.amberInk, fontFamily: font.medium, fontSize: 13, marginTop: 4 }}>Waiting for payout setup</Text>
            {expanded ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontFamily: font.body, fontSize: 15 }}>Customer paid {formatUsd(customerPaid)}</Text>
                <Text style={{ fontFamily: font.body, fontSize: 15 }}>{APP_NAME} fee {formatUsd(fee)}</Text>
                <Text style={{ fontFamily: font.body, fontSize: 15 }}>Your pay {formatUsd(row.amount_cents)}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
