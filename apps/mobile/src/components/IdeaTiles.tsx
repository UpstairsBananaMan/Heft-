import { FlatList, Pressable, Text, View } from "react-native";
import { defaultSize, type SizeCategory } from "@heft/shared";
import { Illustration } from "./Illustration";
import { C, font } from "./v2";
import { haptic } from "../lib/haptics";
import type { IllustrationName } from "../illustrations/markup";

export type IdeaTile = {
  id: string;
  name: string;
  art: IllustrationName;
  itemType: string;
  description: string;
  hardware?: boolean;
  size?: SizeCategory;
};

export const IDEA_TILES: IdeaTile[] = [
  { id: "marketplace", name: "Marketplace find", art: "idea-marketplace", itemType: "furniture", description: "Furniture" },
  { id: "hardware", name: "Home Depot / Lowe's run", art: "idea-hardware-run", itemType: "lumber", description: "Building materials", hardware: true },
  { id: "mattress", name: "New mattress", art: "idea-mattress", itemType: "mattress", description: "Mattress" },
  { id: "appliance", name: "Appliance swap", art: "idea-appliance-swap", itemType: "appliance", description: "Appliance" },
  { id: "moving", name: "Moving out", art: "idea-moving-out", itemType: "moving_out", description: "A room's worth", size: defaultSize("moving_out") ?? "truckload" },
];

const TILE = 148;
const GAP = 12;

export function IdeaTiles({ onPick }: { onPick: (tile: IdeaTile) => void }) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 16, color: C.ink }}>Need ideas?</Text>
        <Text style={{ fontFamily: font.body, fontSize: 14, color: C.steel }}>Tap to start</Text>
      </View>
      <FlatList
        horizontal
        data={IDEA_TILES}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={TILE + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingRight: 24, gap: GAP }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, start a booking`}
            onPress={() => {
              haptic.light();
              onPick(item);
            }}
            style={({ pressed }) => ({
              width: TILE,
              minHeight: 170,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: C.sand200,
              backgroundColor: C.white,
              padding: 10,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <View accessible={false} style={{ width: 120, height: 88, borderRadius: 12, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }}>
              <Illustration name={item.art} width={108} height={78} />
            </View>
            <Text style={{ marginTop: 8, fontFamily: font.semi, fontSize: 15, lineHeight: 20, color: C.ink }}>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
