import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star } from "lucide-react-native";
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
        const person = await supabase.from("users").select("display_name").eq("id", driver).maybeSingle();
        const display = (person.data as { display_name?: string } | null)?.display_name;
        if (display) setName(display.split(" ")[0]);
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
      });
      if (insertError) throw insertError;
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
          {error ? <Text style={{ color: C.red, marginTop: 8 }}>{error}</Text> : null}
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="Submit" disabled={stars < 1} onPress={() => void submit()} />
          </View>
        </>
      )}
    </View>
  );
}
