import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Armchair,
  ArrowRight,
  Bell,
  BrickWall,
  Check,
  ChevronRight,
  Clock,
  Home as HomeIcon,
  Refrigerator,
  Search,
  Sofa,
} from "lucide-react-native";
import {
  CUSTOMER_STATUS,
  ITEM_LABEL,
  type QuoteLine,
  PENSACOLA_CENTER,
  driversApprovedLabel,
  formatUsd,
  haversineMiles,
  neighbourhood,
  pickVehicle,
  type FeedPost,
  type Job,
  type PlacePreset,
  type SizeCategory,
} from "@heft/shared";
import { JobMap, type MapPin } from "../../../src/components/JobMap";
import { DroppingIllustration, Illustration } from "../../../src/components/Illustration";
import { CountUp, SkipLayer, useDelight } from "../../../src/components/delight";
import { IdeaTiles, type IdeaTile } from "../../../src/components/IdeaTiles";
import { TownFeed } from "../../../src/components/TownFeed";
import { C, font, PrimaryButton, Sheet, Wordmark } from "../../../src/components/v2";
import { demoMode, supabase } from "../../../src/lib/supabase";
import { errorText, invoke } from "../../../src/lib/invoke";
import { haptic } from "../../../src/lib/haptics";
import { useBooking } from "../../../src/store/booking";
import { useSession } from "../../../src/store/session";

const RECENTS: PlacePreset[] = [
  { label: "Home", address: "1200 E Gadsden St, Pensacola", lat: 30.436, lng: -87.191 },
  { label: "412 N Spring St", address: "North Hill, Pensacola", lat: 30.4165, lng: -87.221 },
];

const ITEMS = [
  { id: "couch", label: "Couch", Icon: Sofa },
  { id: "mattress", label: "Mattress", Icon: HomeIcon },
  { id: "appliance", label: "Appliance", Icon: Refrigerator },
  { id: "lumber", label: "Lumber / materials", Icon: BrickWall },
  { id: "furniture", label: "Furniture (other)", Icon: Armchair },
  { id: "other", label: "Other", Icon: Armchair },
] as const;

const SIZES: { id: SizeCategory; name: string; example: string; bars: number }[] = [
  { id: "small", name: "Small", example: "Chair", bars: 1 },
  { id: "medium", name: "Medium", example: "Loveseat", bars: 2 },
  { id: "large", name: "Large", example: "3-seat sofa", bars: 3 },
  { id: "xl", name: "Extra large", example: "Sectional", bars: 4 },
];

export default function CustomerHome() {
  const router = useRouter();
  const window = useWindowDimensions();
  const profile = useSession((state) => state.profile);
  const booking = useBooking();
  const scroll = useRef<ScrollView>(null);
  const [snap, setSnap] = useState(0);
  const jobs = useQuery({
    queryKey: ["my-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
  const active = (jobs.data ?? []).find((job) =>
    ["open", "assigned", "en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff"].includes(job.status),
  );
  const pins: MapPin[] = [
    { id: "me", lat: PENSACOLA_CENTER.lat, lng: PENSACOLA_CENTER.lng, title: "", kind: "user" },
  ];
  if (booking.pickup) pins.push({ id: "pickup", lat: booking.pickup.lat, lng: booking.pickup.lng, title: "Pickup", kind: "pickup" });
  if (booking.dropoff) pins.push({ id: "dropoff", lat: booking.dropoff.lat, lng: booking.dropoff.lng, title: "Drop-off", kind: "dropoff" });

  function pickIdea(tile: IdeaTile) {
    booking.patch({
      itemType: tile.itemType,
      itemDescription: tile.description,
      size: tile.size ?? null,
      presetItem: true,
      suggestHardware: Boolean(tile.hardware),
      skipAfterAddress: tile.size ? "price" : "size",
      stairs: false,
      needsHelper: false,
      dropoffPlacement: "inside",
      lines: null,
      totalCents: null,
    });
    router.push("/(customer)/where");
  }

  function moveLike(post: FeedPost) {
    booking.patch({
      itemType: post.item_type,
      itemDescription: post.item_label,
      size: (post.size_category as SizeCategory | null) ?? "large",
      presetItem: true,
      suggestHardware: false,
      skipAfterAddress: "price",
      stairs: false,
      needsHelper: false,
      dropoffPlacement: "inside",
      lines: null,
      totalCents: null,
    });
    setSnap(0);
    haptic.select();
    router.push("/(customer)/where");
  }

  const first = profile?.display_name?.split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const sheetHeight = booking.step === "home" ? Math.round(window.height * [0.5, 0.72, 0.94][snap]) : booking.step === "size" ? undefined : Math.round(window.height * 0.86);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flex: 1 }}>
        <JobMap pins={pins} />
        <View style={{ position: "absolute", top: 52, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Wordmark color={C.ink} size={22} />
          </View>
          <Pressable accessibilityLabel="Alerts" style={floatBtn}>
            <Bell color={C.ink} size={20} />
          </Pressable>
        </View>
        {booking.step !== "home" && booking.pickup && booking.dropoff ? (
          <Pressable
            onPress={() => router.push("/(customer)/where")}
            style={{
              position: "absolute",
              top: 108,
              left: 16,
              right: 16,
              backgroundColor: C.white,
              borderRadius: 18,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pressable onPress={() => booking.patch({ step: "home" })} style={floatBtn}>
              <Text style={{ fontSize: 18 }}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.semi, fontSize: 14, color: C.ink }}>{short(booking.pickup.address)}</Text>
              <Text style={{ fontFamily: font.semi, fontSize: 14, color: C.ink }}>{short(booking.dropoff.address)}</Text>
            </View>
            <Text style={{ fontFamily: font.medium, color: C.steel, fontSize: 14 }}>
              {haversineMiles(booking.pickup.lat, booking.pickup.lng, booking.dropoff.lat, booking.dropoff.lng).toFixed(1)} mi
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: sheetHeight }}>
      <Sheet
        height={sheetHeight}
        onHandle={
          booking.step === "home"
            ? () => {
                setSnap((value) => (value + 1) % 3);
                haptic.select();
              }
            : undefined
        }
      >
        {booking.step === "home" ? (
          <View style={{ flex: 1 }}>
            {first ? <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 14 }}>{hello}, {first}</Text> : null}
            <Text style={{ fontFamily: font.heading, fontSize: 26, color: C.ink, marginTop: 4, marginBottom: 12 }}>Where's it going?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(customer)/where")}
              style={{ minHeight: 56, borderRadius: 16, backgroundColor: C.amber, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 }}
            >
              <Search color={C.ink} size={18} />
              <Text style={{ flex: 1, fontFamily: font.semi, fontSize: 16, color: C.ink }}>Enter pickup & drop-off</Text>
              <ArrowRight color={C.ink} size={18} />
            </Pressable>
            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }}>
              {active ? (
                <Pressable onPress={() => router.push(`/job/${active.id}`)} style={{ backgroundColor: C.paper, borderRadius: 14, padding: 12, marginTop: 12 }}>
                  <Text style={{ fontFamily: font.semi, fontSize: 16, color: C.ink }}>
                    {active.item_description} · {CUSTOMER_STATUS[active.status]}
                  </Text>
                </Pressable>
              ) : null}
              <IdeaTiles onPick={pickIdea} />
              {demoMode ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: C.steel, fontFamily: font.semi, fontSize: 12, letterSpacing: 0.8 }}>RECENT</Text>
                  {RECENTS.map((place) => (
                    <Pressable
                      key={place.address}
                      onPress={() => {
                        booking.setDropoff(place);
                        if (!booking.pickup) {
                          booking.setPickup({ label: "Current location", address: "1200 E Gadsden St", lat: 30.436, lng: -87.191 });
                        }
                        router.push("/(customer)/where");
                      }}
                      style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.sand150, alignItems: "center", justifyContent: "center" }}>
                        {place.label === "Home" ? <HomeIcon color={C.steel} size={18} /> : <Clock color={C.steel} size={18} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: font.semi, fontSize: 16, color: C.ink }}>{place.label}</Text>
                        <Text style={{ fontFamily: font.body, fontSize: 14, color: C.steel }}>{place.address}</Text>
                      </View>
                      <ChevronRight color={C.steel400} size={18} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <TownFeed
                onMoveLike={moveLike}
                onTop={() => {
                  scroll.current?.scrollTo({ y: 0, animated: true });
                  setSnap(0);
                }}
              />
              <Text style={{ marginTop: 12, color: C.steel, fontFamily: font.body, fontSize: 14 }}>Pensacola area only for now.</Text>
            </ScrollView>
          </View>
        ) : null}
        {booking.step === "item" || booking.step === "size" ? (
          <ItemStep sizeOnly={booking.step === "size"} onPrice={() => booking.patch({ step: "price" })} />
        ) : null}
        {booking.step === "price" ? <PriceStep onBooked={(id) => router.replace(`/job/${id}`)} /> : null}
      </Sheet>
      </View>
    </View>
  );
}

function short(address: string) {
  return address.split(",")[0];
}

const floatBtn = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: C.white,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

function ItemStep({ onPrice, sizeOnly }: { onPrice: () => void; sizeOnly?: boolean }) {
  const booking = useBooking();
  const ready = Boolean(booking.itemType && booking.size && (booking.itemType !== "other" || booking.itemDescription.trim().length > 1));
  const label = !booking.itemType ? "Choose an item" : !booking.size ? "Choose a size" : "See price";
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
      {sizeOnly ? null : <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 14 }}>Step 2 of 3 · Item</Text>}
      {sizeOnly ? null : (
      <View style={{ flexDirection: "row", gap: 6, marginVertical: 8 }}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= 1 ? C.ink : C.sand200 }} />
        ))}
      </View>
      )}
      <Text style={{ fontFamily: font.heading, fontSize: 24, color: C.ink, marginBottom: 12 }}>{sizeOnly ? "How big is it?" : "What are you moving?"}</Text>
      {sizeOnly ? null : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ITEMS.map((item) => {
          const selected = booking.itemType === item.id;
          const Icon = item.Icon;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic.select();
                booking.patch({
                  itemType: item.id,
                  itemDescription: item.id === "other" ? booking.itemDescription : ITEM_LABEL[item.id],
                });
              }}
              style={{
                width: "31%",
                minHeight: 92,
                borderRadius: 16,
                borderWidth: selected ? 2 : 1.5,
                borderColor: selected ? C.ink : C.sand200,
                backgroundColor: selected ? C.amber50 : C.white,
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
              }}
            >
              {selected ? (
                <View style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                  <Check color={C.paper} size={12} />
                </View>
              ) : null}
              <Icon color={C.ink} size={26} strokeWidth={1.6} />
              <Text style={{ marginTop: 6, textAlign: "center", fontFamily: font.semi, fontSize: 14, color: C.ink }}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>}
      {booking.itemType === "other" && !sizeOnly ? (
        <TextInput
          accessibilityLabel="What is it?"
          value={booking.itemDescription}
          onChangeText={(itemDescription) => booking.patch({ itemDescription: itemDescription.slice(0, 40) })}
          placeholder="What is it?"
          placeholderTextColor={C.steel500}
          style={{ marginTop: 12, minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: C.sand600, paddingHorizontal: 12, fontSize: 16, fontFamily: font.body }}
        />
      ) : null}
      {sizeOnly ? null : <Text style={{ marginTop: 18, marginBottom: 8, fontFamily: font.heading, fontSize: 18, color: C.ink }}>How big is it?</Text>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SIZES.map((size) => {
          const selected = booking.size === size.id;
          return (
            <Pressable
              key={size.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic.select();
                booking.patch({ size: size.id });
                if (sizeOnly) onPrice();
              }}
              style={{
                flex: 1,
                minHeight: 88,
                borderRadius: 14,
                borderWidth: selected ? 2 : 1.5,
                borderColor: selected ? C.ink : C.sand200,
                backgroundColor: selected ? C.amber50 : C.white,
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
              }}
            >
              <View style={{ width: 18 + size.bars * 6, height: 8, borderRadius: 3, backgroundColor: selected ? C.amber : C.sand300, marginBottom: 8 }} />
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: C.ink, textAlign: "center" }}>{size.name}</Text>
              <Text style={{ fontFamily: font.body, fontSize: 12, color: C.steel, textAlign: "center" }}>{size.example}</Text>
            </Pressable>
          );
        })}
      </View>
      {sizeOnly ? null : <>
      <Question
        title="Stairs at either stop?"
        value={booking.stairs ? "yes" : "no"}
        options={[
          { id: "no", label: "No" },
          { id: "yes", label: "Yes" },
        ]}
        onChange={(value) => booking.patch({ stairs: value === "yes", stairsPickupFlights: value === "yes" ? Math.max(1, booking.stairsPickupFlights) : 0 })}
      />
      <Question
        title="Need a helper to load?"
        value={booking.needsHelper ? "yes" : "no"}
        options={[
          { id: "no", label: "No, I'll help" },
          { id: "yes", label: "Yes" },
        ]}
        onChange={(value) => booking.patch({ needsHelper: value === "yes" })}
      />
      <Question
        title="At drop-off"
        value={booking.dropoffPlacement}
        options={[
          { id: "inside", label: "Inside" },
          { id: "curbside", label: "Curbside" },
        ]}
        onChange={(value) => booking.patch({ dropoffPlacement: value as "inside" | "curbside" })}
        />
      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          label={label}
          disabled={!ready}
          onPress={() => {
            haptic.medium();
            onPrice();
          }}
        />
      </View>
      </>}
    </ScrollView>
  );
}

function Question({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontFamily: font.semi, fontSize: 16, color: C.ink, marginBottom: 8 }}>{title}</Text>
      <View style={{ flexDirection: "row", backgroundColor: C.sand150, borderRadius: 12, padding: 3 }}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => {
                haptic.select();
                onChange(option.id);
              }}
              style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: selected ? C.white : "transparent" }}
            >
              <Text style={{ fontFamily: font.semi, fontSize: 14, color: C.ink }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PriceStep({ onBooked }: { onBooked: (id: string) => void }) {
  const profile = useSession((state) => state.profile);
  const booking = useBooking();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [rowsOn, setRowsOn] = useState(false);
  const [bookOn, setBookOn] = useState(false);
  const delight = useDelight({
    jobId: booking.jobId,
    moment: "price",
    announce: booking.totalCents ? `Price ready, ${formatUsd(booking.totalCents)}` : "",
    enabled: Boolean(booking.totalCents),
  });

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!profile || !booking.pickup || !booking.dropoff || !booking.itemType || !booking.size) return;
      setPending(true);
      setError("");
      try {
        const vehicle = pickVehicle(booking.itemType, booking.size);
        const payload = {
          customer_id: profile.id,
          status: "draft" as const,
          pickup_address: booking.pickup.address,
          pickup_lat: booking.pickup.lat,
          pickup_lng: booking.pickup.lng,
          dropoff_address: booking.dropoff.address,
          dropoff_lat: booking.dropoff.lat,
          dropoff_lng: booking.dropoff.lng,
          dropoff_notes: booking.notes || null,
          item_description: booking.itemDescription || ITEM_LABEL[booking.itemType as keyof typeof ITEM_LABEL],
          item_type: booking.itemType,
          size_category: booking.size,
          vehicle_required: vehicle,
          stairs_pickup_flights: booking.stairs ? booking.stairsPickupFlights : 0,
          stairs_dropoff_flights: booking.stairs ? booking.stairsDropoffFlights : 0,
          needs_helper: booking.needsHelper,
          dropoff_placement: booking.dropoffPlacement,
        };
        let id = booking.jobId;
        if (!id) {
          const { data, error: insertError } = await supabase.from("jobs").insert(payload).select("id").single();
          if (insertError) throw insertError;
          id = data.id as string;
          booking.patch({ jobId: id });
        } else {
          const { error: updateError } = await supabase.from("jobs").update(payload).eq("id", id);
          if (updateError) throw updateError;
        }
        const quoted = await invoke<{ lines: QuoteLine[]; total_cents: number; distance_miles: number }>("quote", { job_id: id });
        if (cancel) return;
        booking.patch({ lines: quoted.lines, totalCents: quoted.total_cents, miles: quoted.distance_miles });
      } catch (err) {
        if (!cancel) setError(errorText(err));
      } finally {
        if (!cancel) setPending(false);
      }
    }
    void run();
    return () => {
      cancel = true;
    };
    // Quote when the priced answers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.itemType, booking.size, booking.stairs, booking.needsHelper, booking.pickup?.address, booking.dropoff?.address, profile?.id]);

  useEffect(() => {
    if (!booking.totalCents) return;
    if (delight.settled || delight.reduced) {
      setRowsOn(true);
      setBookOn(true);
      return;
    }
    if (!delight.playing) return;
    const rowsTimer = setTimeout(() => setRowsOn(true), 640);
    const bookTimer = setTimeout(() => setBookOn(true), 900);
    return () => {
      clearTimeout(rowsTimer);
      clearTimeout(bookTimer);
    };
  }, [booking.totalCents, delight.playing, delight.settled, delight.reduced]);

  async function book() {
    if (!booking.jobId) return;
    setPending(true);
    setError("");
    try {
      haptic.medium();
      await invoke("publish-job", { job_id: booking.jobId });
      haptic.success();
      const id = booking.jobId;
      booking.reset();
      onBooked(id);
    } catch (err) {
      setError(errorText(err));
      haptic.error();
    } finally {
      setPending(false);
    }
  }

  const route = booking.pickup && booking.dropoff ? `${neighbourhood(booking.pickup.address)} → ${neighbourhood(booking.dropoff.address)}` : "";
  const reveal = Boolean(booking.totalCents) && (delight.playing || delight.settled);
  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
      <Text style={{ fontFamily: font.heading, fontSize: 22, color: C.ink }}>Your price</Text>
      <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14, marginBottom: 12 }}>{route}</Text>
      <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.sand200, padding: 16 }}>
        {error ? <Illustration name="box-oops" width={72} height={72} /> : null}
        {reveal && !error ? <DroppingIllustration play={delight.playing && !delight.reduced} size={72} /> : null}
        <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 14 }}>All-in price</Text>
        {booking.totalCents ? (
          <CountUp cents={booking.totalCents} play={delight.playing && !delight.reduced} />
        ) : (
          <Text style={{ fontFamily: font.display, fontSize: 44, color: C.ink }}>{pending ? "…" : ""}</Text>
        )}
        {rowsOn ? (booking.lines ?? []).map((line) => (
          <View key={line.key} style={{ flexDirection: "row", justifyContent: "space-between", minHeight: 30 }}>
            <Text style={{ fontFamily: font.body, fontSize: 16, color: C.ink }}>{line.label}</Text>
            <Text style={{ fontFamily: font.semi, fontSize: 16, color: C.ink }}>{line.key === "base_miles" ? formatUsd(line.cents) : `+ ${formatUsd(line.cents)}`}</Text>
          </View>
        )) : null}
        <View style={{ height: 1, backgroundColor: C.sand200, marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: font.bold, fontSize: 16 }}>Total</Text>
          <Text style={{ fontFamily: font.bold, fontSize: 16 }}>{formatUsd(booking.totalCents)}</Text>
        </View>
        <Text style={{ marginTop: 8, color: C.steel, fontFamily: font.body, fontSize: 13 }}>No surprise fees.</Text>
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between", minHeight: 44, alignItems: "center" }}>
        <Text style={{ fontFamily: font.body, fontSize: 16 }}>When</Text>
        <Text style={{ fontFamily: font.semi, fontSize: 16 }}>ASAP</Text>
      </View>
      <Pressable onPress={() => booking.patch({ step: "item" })} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ fontFamily: font.semi, fontSize: 16, textDecorationLine: "underline" }}>Edit</Text>
      </Pressable>
      {error ? <Text style={{ color: C.red, fontFamily: font.body, fontSize: 14, marginBottom: 8 }}>{error}</Text> : null}
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: C.green, fontFamily: font.semi, fontSize: 14 }}>All-in price, set before you book</Text>
        <Text style={{ color: C.green, fontFamily: font.semi, fontSize: 14 }}>{driversApprovedLabel()}</Text>
      </View>
      <View pointerEvents={bookOn && !delight.locked ? "auto" : "none"} style={{ opacity: bookOn ? 1 : 0 }}>
        <PrimaryButton label={pending ? "Getting your price…" : `Book for ${formatUsd(booking.totalCents)}`} disabled={pending || !booking.totalCents || delight.locked} onPress={() => void book()} />
      </View>
      <Text style={{ textAlign: "center", marginTop: 8, fontFamily: font.body, fontSize: 14, color: C.steel }}>You're charged after delivery.</Text>
      <Text style={{ textAlign: "center", marginTop: 4, fontFamily: font.body, fontSize: 13, color: C.steel }}>
        Cancel free until your driver arrives at pickup.
      </Text>
      {demoMode ? <Text style={{ textAlign: "center", marginTop: 4, fontFamily: font.body, fontSize: 13, color: C.steel }}>Demo: no card is charged.</Text> : null}
    </ScrollView>
    <SkipLayer active={delight.playing} onSkip={delight.skip} />
    </View>
  );
}
