import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { driverRatingLabel, postsForFeed, showStarRating, type FeedPost } from "@heft/shared";
import { Illustration } from "./Illustration";
import { FloatingIllustration } from "./Illustration";
import { C, font, OutlineButton } from "./v2";
import { demoMode, supabase } from "../lib/supabase";
import { haptic } from "../lib/haptics";
import type { IllustrationName } from "../illustrations/markup";
import { ILLUSTRATIONS } from "../illustrations/markup";

const CARD_HEIGHT = 292;

export function TownFeed({ onMoveLike, onTop }: { onMoveLike: (post: FeedPost) => void; onTop: () => void }) {
  const [zoom, setZoom] = useState<{ name: IllustrationName; label: string } | null>(null);
  const feed = useQuery({
    queryKey: ["town-feed", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_posts").select("*").eq("status", "approved");
      if (error) throw error;
      return postsForFeed((data ?? []) as FeedPost[], demoMode);
    },
  });
  if (feed.isError) return null;
  if (feed.isLoading) {
    return (
      <View style={{ marginTop: 8 }}>
        <Skeleton />
        <Skeleton />
      </View>
    );
  }
  const posts = feed.data ?? [];
  if (posts.length < 3) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.heading, fontSize: 19, color: C.ink }}>Moves around town</Text>
          <Text style={{ fontFamily: font.body, fontSize: 14, color: C.steel, marginTop: 2 }}>Real before-and-afters</Text>
          {demoMode ? <DemoPill /> : null}
        </View>
        <Illustration name="feed-header" width={120} height={48} />
      </View>
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} onMoveLike={() => onMoveLike(post)} onZoom={setZoom} />
      ))}
      <View style={{ marginTop: 8, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: C.sand300, padding: 16, alignItems: "center" }}>
        <FloatingIllustration name="feed-end" size={120} />
        <Text style={{ marginTop: 8, fontFamily: font.heading, fontSize: 18, color: C.ink }}>That's everything for now</Text>
        <Text style={{ marginTop: 4, textAlign: "center", fontFamily: font.body, fontSize: 16, color: C.steel }}>
          New moves show up here after real deliveries. Got something big?
        </Text>
        <Pressable accessibilityRole="link" onPress={onTop} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semi, fontSize: 16, textDecorationLine: "underline", color: C.ink }}>Back to top</Text>
        </Pressable>
      </View>
      <Modal visible={Boolean(zoom)} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable accessibilityLabel="Close photo" onPress={() => setZoom(null)} style={{ flex: 1, backgroundColor: "rgba(26,29,33,0.48)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {zoom ? (
            <View accessibilityLabel={zoom.label}>
              <Illustration name={zoom.name} width={300} height={220} />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function FeedCard({
  post,
  onMoveLike,
  onZoom,
}: {
  post: FeedPost;
  onMoveLike: () => void;
  onZoom: (photo: { name: IllustrationName; label: string }) => void;
}) {
  const summary = `${post.item_label}, ${post.pickup_area} to ${post.dropoff_area}, ${post.month_label}.${post.driver_name ? ` Moved by ${post.driver_name}.` : ""}`;
  const before = isArt(post.before_key);
  const after = isArt(post.after_key);
  const stars = showStarRating(Number(post.rating_count ?? 0));
  return (
    <View accessibilityLabel={summary} style={{ marginTop: 12, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.sand200, padding: 12, minHeight: CARD_HEIGHT }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Photo
          art={before}
          label={`Before: ${post.item_label.toLowerCase()} at pickup.`}
          onPress={() => before && onZoom({ name: before, label: `Before: ${post.item_label.toLowerCase()} at pickup.` })}
        />
        <Photo
          art={after}
          label={`After: ${post.item_label.toLowerCase()} delivered.`}
          onPress={() => after && onZoom({ name: after, label: `After: ${post.item_label.toLowerCase()} delivered.` })}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
        <Text style={{ flex: 1, fontFamily: font.heading, fontSize: 18, color: C.ink }}>{post.item_label}</Text>
        {post.is_demo ? <DemoPill /> : null}
      </View>
      <Text style={{ fontFamily: font.body, fontSize: 14, color: C.steel, marginTop: 2 }}>
        {post.pickup_area} → {post.dropoff_area} · {post.month_label}
      </Text>
      {post.driver_name ? (
        <Text style={{ marginTop: 6, fontFamily: font.body, fontSize: 14, color: C.ink }}>
          Moved by {post.driver_name}{" "}
          <Text style={{ color: C.steel }}>{stars ? `★ ${driverRatingLabel(Number(post.rating_count), Number(post.rating_avg))}` : "New driver"}</Text>
        </Text>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <OutlineButton
          label="Move something like this"
          onPress={() => {
            haptic.light();
            onMoveLike();
          }}
        />
      </View>
    </View>
  );
}

function Photo({ art, label, onPress }: { art: IllustrationName | null; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={{ flex: 1, height: 96, borderRadius: 12, overflow: "hidden", backgroundColor: C.sand150 }}>
      <View style={{ position: "absolute", top: 6, left: 6, zIndex: 1, backgroundColor: "rgba(26,29,33,0.72)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ color: C.paper, fontFamily: font.medium, fontSize: 12 }}>{label.startsWith("Before") ? "Before" : "After"}</Text>
      </View>
      {art ? <Illustration name={art} width={160} height={96} /> : null}
    </Pressable>
  );
}

function DemoPill() {
  return (
    <View style={{ alignSelf: "flex-start", marginTop: 6, borderWidth: 1, borderStyle: "dashed", borderColor: C.steel, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: C.steel }}>Demo</Text>
    </View>
  );
}

function Skeleton() {
  return <View style={{ height: 160, borderRadius: 18, backgroundColor: C.sand150, marginTop: 12 }} />;
}

function isArt(key: string | null): IllustrationName | null {
  if (!key) return null;
  if (key in ILLUSTRATIONS) return key as IllustrationName;
  return null;
}
