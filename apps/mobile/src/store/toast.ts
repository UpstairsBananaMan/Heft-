import { create } from "zustand";

type ToastTone = "error" | "ok";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastState = {
  current: Toast | null;
  show: (message: string, tone?: ToastTone) => void;
  clear: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  current: null,
  show: (message, tone = "error") => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ current: { id: Date.now(), message, tone } });
    hideTimer = setTimeout(() => set({ current: null }), 4500);
  },
  clear: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ current: null });
  },
}));

export function toast(message: string, tone: ToastTone = "error") {
  useToast.getState().show(message, tone);
}
