import React from "react";
import {
  Swords,
  Handshake,
  HeartPulse,
  Brain,
  CloudRain,
  UserPlus,
  Zap,
  Compass,
} from "lucide-react";
import { ThemeMode } from "../../types";

export const TEMPLATE_ICON_KEYS = [
  "swords",
  "handshake",
  "heart-pulse",
  "brain",
  "cloud-rain",
  "user-plus",
  "compass",
] as const;

export function TemplateIcon({
  icon,
  className,
}: {
  icon?: string;
  className?: string;
}) {
  const cls = className || "w-3.5 h-3.5";
  switch (icon) {
    case "swords":
      return <Swords className={cls} />;
    case "handshake":
      return <Handshake className={cls} />;
    case "heart-pulse":
      return <HeartPulse className={cls} />;
    case "brain":
      return <Brain className={cls} />;
    case "cloud-rain":
      return <CloudRain className={cls} />;
    case "user-plus":
      return <UserPlus className={cls} />;
    case "compass":
      return <Compass className={cls} />;
    default:
      return <Zap className={cls} />;
  }
}

export interface AccentClasses {
  text: string;
  chip: string;
  solid: string;
}

/** Theme-aware accent color classes (literal strings so Tailwind keeps them). */
export function accentClasses(accent?: string, theme?: ThemeMode): AccentClasses {
  const key = accent || "amber";
  const light = theme === "parchment";
  const t = (c400: string, c700: string) => (light ? c700 : c400);

  switch (key) {
    case "red":
      return {
        text: t("text-red-400", "text-red-700"),
        chip: "bg-red-500/15 border-red-500/40 hover:bg-red-500/25",
        solid: light ? "bg-red-800 hover:bg-red-700 text-red-50" : "bg-red-600 hover:bg-red-500 text-white",
      };
    case "emerald":
      return {
        text: t("text-emerald-400", "text-emerald-700"),
        chip: "bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25",
        solid: light ? "bg-emerald-800 hover:bg-emerald-700 text-emerald-50" : "bg-emerald-600 hover:bg-emerald-500 text-white",
      };
    case "blue":
      return {
        text: t("text-blue-400", "text-blue-700"),
        chip: "bg-blue-500/15 border-blue-500/40 hover:bg-blue-500/25",
        solid: light ? "bg-blue-800 hover:bg-blue-700 text-blue-50" : "bg-blue-600 hover:bg-blue-500 text-white",
      };
    case "amber":
      return {
        text: t("text-amber-400", "text-amber-700"),
        chip: "bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25",
        solid: light ? "bg-amber-800 hover:bg-amber-700 text-amber-50" : "bg-amber-600 hover:bg-amber-500 text-white",
      };
    case "cyan":
      return {
        text: t("text-cyan-400", "text-cyan-700"),
        chip: "bg-cyan-500/15 border-cyan-500/40 hover:bg-cyan-500/25",
        solid: light ? "bg-cyan-800 hover:bg-cyan-700 text-cyan-50" : "bg-cyan-600 hover:bg-cyan-500 text-white",
      };
    case "violet":
      return {
        text: t("text-violet-400", "text-violet-700"),
        chip: "bg-violet-500/15 border-violet-500/40 hover:bg-violet-500/25",
        solid: light ? "bg-violet-800 hover:bg-violet-700 text-violet-50" : "bg-violet-600 hover:bg-violet-500 text-white",
      };
    default:
      return accentClasses("amber", theme);
  }
}