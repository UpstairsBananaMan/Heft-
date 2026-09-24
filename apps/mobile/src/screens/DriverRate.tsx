import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Job } from "@heft/shared";
import { Button, ErrorText, Field, Screen } from "../components/ui";
import { errorText } from "../lib/invoke";
import { supabase } from "../lib/supabase";
import { useSession } from "../store/session";

export default function DriverRate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (queryError) throw queryError;
      return data as Job;
    },
  });

  async function submit() {
    const row = job.data;
    if (!row || !profile) return;
    setPending(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("ratings").insert({
        job_id: row.id,
        from_user_id: profile.id,
        to_user_id: row.customer_id,
        stars,
        comment: comment.trim() || null,
      });
      if (insertError) throw insertError;
      router.back();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="Rate customer" back>
      <Text className="mb-4 text-sm text-steel">One rating per person on this job.</Text>
      <View className="mb-4 flex-row gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => setStars(value)} className={`min-h-[48px] min-w-[48px] items-center justify-center border border-line ${value <= stars ? "bg-amber" : "bg-white"}`}>
            <Text className="font-semibold text-charcoal">{value}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Comment" value={comment} onChangeText={setComment} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Saving" : "Submit rating"} disabled={pending} onPress={submit} />
    </Screen>
  );
}
