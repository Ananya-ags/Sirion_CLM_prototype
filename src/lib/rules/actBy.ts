/**
 * Act-by dates (Rules). Pure, timezone-safe: all dates are ISO yyyy-mm-dd handled in UTC.
 * Conventions (dev_gold meta.act_by_conventions):
 *  - calendar: act_by = term_end − notice_days (no weekend/holiday roll)
 *  - business: count back notice_days business days from term_end (term_end not counted;
 *    Mon–Fri minus holidays.json); the last day counted is act_by
 *  - decision target = act_by − internal_buffer_days
 */
import { DEMO_TODAY } from "../config";

export type DayType = "calendar" | "business";

const MS_DAY = 86_400_000;
const toUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * MS_DAY);
}

/** Whole days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / MS_DAY);
}

export function isBusinessDay(iso: string, holidays: ReadonlySet<string>): boolean {
  const dow = new Date(toUTC(iso)).getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays.has(iso);
}

export function computeActBy(termEnd: string, noticeDays: number, dayType: DayType, holidays: ReadonlySet<string>): string {
  if (dayType === "calendar") return addDays(termEnd, -noticeDays);
  let d = termEnd;
  let counted = 0;
  while (counted < noticeDays) {
    d = addDays(d, -1);
    if (isBusinessDay(d, holidays)) counted++;
  }
  return d;
}

export type ActByInfo = {
  actBy: string;
  rule: string;
  /** act_by − internal buffer */
  decisionTarget: string;
  decisionTargetPassed: boolean;
  daysToActBy: number;
  actByIsBusinessDay: boolean;
};

export type ActByInput = {
  renewalType: string | null;
  termEnd: string | null;
  noticeDays: number | null;
  dayType: DayType | null;
  holidays: ReadonlySet<string>;
  bufferDays: number;
  today?: string;
};

/** Only auto-renewing contracts have a renewal act-by date. Anything unclear → null (human review). */
export function actByInfo(i: ActByInput): ActByInfo | null {
  if (i.renewalType !== "auto" || !i.termEnd || i.noticeDays == null || !i.dayType) return null;
  const today = i.today ?? DEMO_TODAY;
  const actBy = computeActBy(i.termEnd, i.noticeDays, i.dayType, i.holidays);
  const decisionTarget = addDays(actBy, -i.bufferDays);
  return {
    actBy,
    rule:
      i.dayType === "business"
        ? `${i.noticeDays} business days before term end ${i.termEnd} (holidays.json, term-end day not counted)`
        : `${i.noticeDays} calendar days before term end ${i.termEnd}`,
    decisionTarget,
    decisionTargetPassed: decisionTarget < today,
    daysToActBy: daysBetween(today, actBy),
    actByIsBusinessDay: isBusinessDay(actBy, i.holidays),
  };
}

/** Evergreen: earliest exit if notice were served today. */
export function earliestExit(noticeDays: number, today = DEMO_TODAY): string {
  return addDays(today, noticeDays);
}
