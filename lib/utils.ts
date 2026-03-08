import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDateDisplay(group: {
  dateMode: string | null;
  consecutiveDays: number | null;
  startDate: string | null;
  endDate: string | null;
}): string {
  if (group.dateMode === "consecutive" && group.consecutiveDays) {
    return `${group.consecutiveDays} consecutive days`;
  }
  if (group.dateMode === "specific" && group.startDate && group.endDate) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    const start = new Date(group.startDate + "T00:00:00");
    const end = new Date(group.endDate + "T00:00:00");
    return `${fmt.format(start)} - ${fmt.format(end)}, 2028`;
  }
  return "Dates not set";
}
