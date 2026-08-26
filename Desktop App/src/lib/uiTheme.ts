import { ThemeMode } from "../types";

/**
 * Native <select> elements ignore translucent backgrounds and fall back to UA
 * chrome (grey control, mismatched popup list). These styles force an opaque,
 * theme-matched surface for both the closed control and its option list.
 */
const SELECT_THEME_CLASSES: Record<ThemeMode, string> = {
  dark:
    "bg-[#141418] text-[#e2e8f0] border-[#25252e] [color-scheme:dark] [&>option]:bg-[#141418] [&>option]:text-[#e2e8f0]",
  parchment:
    "bg-white text-stone-900 border-amber-300 [color-scheme:light] [&>option]:bg-white [&>option]:text-stone-900",
  cyber:
    "bg-slate-950 text-cyan-50 border-cyan-800 [color-scheme:dark] [&>option]:bg-slate-950 [&>option]:text-cyan-50",
};

export function selectClasses(theme: ThemeMode): string {
  return SELECT_THEME_CLASSES[theme];
}
