import { ReactNode } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { House, Package, UserRound } from "lucide-react-native";
import { C, font } from "../../../src/components/v2";

function Pill({ focused, children }: { focused: boolean; children: ReactNode }) {
  return (
    <View
      style={{
        width: 60,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? C.amber100 : "transparent",
      }}
    >
      {children}
    </View>
  );
}

export default function CustomerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.steel,
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.sand200, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Pill focused={focused}>
              <House color={color} size={22} strokeWidth={focused ? 2.1 : 1.75} />
            </Pill>
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "My deliveries",
          tabBarIcon: ({ color, focused }) => (
            <Pill focused={focused}>
              <Package color={color} size={22} strokeWidth={focused ? 2.1 : 1.75} />
            </Pill>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Pill focused={focused}>
              <UserRound color={color} size={22} strokeWidth={focused ? 2.1 : 1.75} />
            </Pill>
          ),
        }}
      />
    </Tabs>
  );
}
