import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star } from "lucide-react-native";
import { feedAreas, monthName, SIZE_LABEL } from "@heft/shared";
import { C, font, PrimaryButton } from "../components/v2";
import { errorText } from "../lib/invoke";
import { haptic } from "../lib/haptics";
import { supabase } from "../lib/supabase";
import { useSession } from "../store/session";

export default function RateJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [name, setName] = useState("your driver");
  const [share, setShare] = useState(false);
  const [jobMeta, setJobMeta] = useState<{ item: string; size: string | null; pickup: string; dropoff: string; when: string } | null>(null);

  useEffect(() => {
    void supabase
      .from("jobs")
      .select("driver_id")
      .eq("id", id)
      .maybeSingle()
      .then(async ({ data }) => {
        const driver = (data as { driver_id: string | null } | null)?.driver_id ?? null;
        setDriverId(driver);
        if (!driver) return;
        const { data: card, error } = await supabase.functions.invoke("assigned_driver_card", { body: { job_id: id } });
        const display = !error && card && typeof card === "object" ? (card as { display_name?: string }).display_name : undefined;
        if (display) setName(display.split(" ")[0]);
        const job = await supabase.from("jobs").select("item_description,size_category,pickup_address,dropoff_address,delivered_at").eq("id", id).maybeSingle();
        const row = job.data as { item_description: string; size_category: string | null; pickup_address: string; dropoff_address: string; delivered_at: string | null } | null;
        if (row) {
          setJobMeta({
            item: row.item_description,
            size: row.size_category,
            pickup: row.pickup_address,
            dropoff: row.dropoff_address,
            when: row.delivered_at ?? new Date().toISOString(),
          });
        }
      });
  }, [id]);

  async function submit() {
    if (!profile || !driverId || stars < 1) return;
    setError("");
    try {
      const { error: insertError } = await supabase.from("ratings").insert({
        job_id: id,
        from_user_id: profile.id,
        to_user_id: driverId,
        stars,
        comment: comment.trim() || null,
        share_photos: share,
      });
      if (insertError) throw insertError;
      if (share && jobMeta) {
        const areas = feedAreas(jobMeta.pickup, jobMeta.dropoff);
        const driver = await supabase.from("driver_profiles").select("show_name_in_feed,rating_avg,rating_count").eq("user_id", driverId).maybeSingle();
        const profileRow = driver.data as { show_name_in_feed?: boolean; rating_avg?: number; rating_count?: number } | null;
        await supabase.from("feed_posts").insert({
          job_id: id,
          status: "pending",
          is_demo: false,
          item_label: `${SIZE_LABEL[jobMeta.size ?? ""] ?? ""} ${jobMeta.item}`.trim(),
          size_label: SIZE_LABEL[jobMeta.size ?? ""] ?? "",
          item_type: null,
          size_category: jobMeta.size,
          pickup_area: areas.pickup_area,
          dropoff_area: areas.dropoff_area,
          month_label: monthName(jobMeta.when),
          driver_name: profileRow?.show_name_in_feed ? name : null,
          rating_avg: profileRow?.rating_avg ?? null,
          rating_count: profileRow?.rating_count ?? null,
          before_key: null,
          after_key: null,
        });
      }
      haptic.success();
      setThanks(true);
      setTimeout(() => router.back(), 1200);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, padding: 24, paddingTop: 72 }}>
      <Pressable onPress={() => router.back()} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Back</Text>
      </Pressable>
      <View style={{ alignSelf: "center", width: 72, height: 72, borderRadius: 36, backgroundColor: C.sand150, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 24 }}>{name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <Text style={{ marginTop: 16, textAlign: "center", fontFamily: font.heading, fontSize: 24 }}>How was your delivery with {name}?</Text>
      {thanks ? (
        <Text style={{ marginTop: 20, textAlign: "center", fontFamily: font.body, fontSize: 16 }}>Thanks! Your rating helps other Pensacola customers.</Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 20 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                onPress={() => {
                  setStars(value);
                  haptic.select();
                }}
                style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
              >
                <Star color={value <= stars ? C.amberInk : C.sand300} fill={value <= stars ? C.amberInk : "transparent"} size={36} strokeWidth={1.75} />
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Comment"
            value={comment}
            onChangeText={setComment}
            placeholder="Add a note (optional)"
            placeholderTextColor={C.steel500}
            multiline
            style={{ marginTop: 16, minHeight: 96, borderRadius: 14, borderWidth: 1, borderColor: C.sand600, padding: 12, fontFamily: font.body, fontSize: 16, textAlignVertical: "top" }}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: share }}
            onPress={() => setShare((value) => !value)}
            style={{ marginTop: 16, minHeight: 44, flexDirection: "row", gap: 10, alignItems: "flex-start" }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.ink, backgroundColor: share ? C.ink : C.white, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.semi, fontSize: 16, color: C.ink }}>Share your before-and-after in Moves around town?</Text>
              <Text style={{ fontFamily: font.body, fontSize: 14, color: C.steel }}>We hide addresses, faces, and plates.</Text>
            </View>
          </Pressable>
          {error ? <Text style={{ color: C.red, marginTop: 8 }}>{error}</Text> : null}
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="Submit" disabled={stars < 1} onPress={() => void submit()} />
          </View>
        </>
      )}
    </View>
  );
}
