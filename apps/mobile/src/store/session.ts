import type { Session } from "@supabase/supabase-js";
import type { User } from "@heft/shared";
import { create } from "zustand";
import { supabase, supabaseConfigured } from "../lib/supabase";

type SessionState = {
  ready: boolean;
  session: Session | null;
  profile: User | null;
  boot: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

let booted = false;

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  session: null,
  profile: null,
  boot: async () => {
    if (booted) return;
    booted = true;
    if (!supabaseConfigured) {
      set({ ready: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) await get().refreshProfile();
    set({ ready: true });
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session });
      if (event === "SIGNED_OUT") set({ profile: null });
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        if (session) await get().refreshProfile();
      }
    });
  },
  refreshProfile: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const id = auth.user?.id;
    if (!id) {
      set({ profile: null });
      return;
    }
    const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    set({ profile: (data as User | null) ?? null });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));
