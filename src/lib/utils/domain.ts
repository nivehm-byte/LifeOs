import type { Domain } from "@/types/database";

// Hex values must match tailwind.config.ts domain colors exactly
export const DOMAIN_HEX: Record<Domain, string> = {
  fitness:    "#7DB87A",
  personal:   "#7BA8C4",
  consulting: "#D4845A",
  corporate:  "#9B8EC4",
};

export const DOMAIN_LABEL: Record<Domain, string> = {
  fitness:    "Fitness",
  personal:   "Personal",
  consulting: "Consulting",
  corporate:  "Corporate",
};

export const DOMAIN_ICON: Record<Domain, string> = {
  fitness:    "🏋️",
  personal:   "🏠",
  consulting: "💼",
  corporate:  "🏢",
};

// Sorted display order for grouping
export const DOMAIN_ORDER: Domain[] = [
  "fitness",
  "personal",
  "consulting",
  "corporate",
];

// hex + alpha as 8-char hex string (e.g. "#7DB87A26" = 15% opacity)
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// Priority colours
export const PRIORITY_HEX = {
  urgent: "#E05C5C",
  high:   "#E0975C",
  medium: "#D4A96A",
  low:    "#7DB87A",
} as const;

export const PRIORITY_LABEL = {
  urgent: "Urgent",
  high:   "High",
  medium: "Medium",
  low:    "Low",
} as const;

// Status display labels for milestones
export const MILESTONE_STATUS_LABEL = {
  upcoming:    "Upcoming",
  "in-progress": "In Progress",
  completed:   "Completed",
  overdue:     "Overdue",
} as const;
