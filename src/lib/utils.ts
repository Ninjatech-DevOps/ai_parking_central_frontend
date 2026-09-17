import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Default date windows the history pages open on.
 *
 * Values are `datetime-local` strings — the format FilterDateInput holds — and
 * `new Date()` parses them as browser-local time, so 00:00 → 23:59 covers the
 * full days for a viewer in IST. Change a range here and every page using it
 * follows.
 */
export type DateRange = { readonly from: string; readonly to: string };

/** AI Parking History and Vehicle In / Out — both open on this window so their
 *  figures describe the same period. */
export const DEFAULT_DATE_RANGE: DateRange = { from: "2026-08-22T00:00", to: "2026-08-27T23:59" };

/** Prahaladnagar MLP (ANPR) History. */
export const DEFAULT_ANPR_DATE_RANGE: DateRange = { from: "2026-07-01T00:00", to: "2026-07-08T23:59" };

/** True when the page's custom range is still its default one, i.e. the user
 *  has not actually filtered — used to keep the Filters badge quiet. */
export function isDefaultDateRange(from: string, to: string, range: DateRange = DEFAULT_DATE_RANGE): boolean {
  return from === range.from && to === range.to;
}
