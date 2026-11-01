import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfToday,
} from 'date-fns'

/*
 * Calendar dates ("2026-11-03") are parsed as local midnight and compared as dates,
 * never as formatted strings. Timestamps ("2026-11-01T10:00:00Z") are UTC instants and
 * are displayed in the browser's local time zone.
 */

export function todayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function formatDay(iso: string) {
  const date = parseISO(iso)
  return format(date, isSameYear(date, new Date()) ? 'MMM d' : 'MMM d, yyyy')
}

export function monthShort(iso: string) {
  return format(parseISO(iso), 'MMM')
}

export function dayOfMonth(iso: string) {
  return format(parseISO(iso), 'd')
}

export function formatDayLong(iso: string) {
  return format(parseISO(iso), 'EEE, MMM d, yyyy')
}

export function formatDateTime(iso: string) {
  return format(parseISO(iso), "MMM d, yyyy 'at' HH:mm")
}

export function relativeTime(iso: string) {
  const date = parseISO(iso)
  if (Math.abs(Date.now() - date.getTime()) < 45_000) return 'just now'
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export function daysUntil(iso: string) {
  return differenceInCalendarDays(parseISO(iso), startOfToday())
}

export function isOverdue(dueIso: string | null, done: boolean) {
  return !done && dueIso !== null && daysUntil(dueIso) < 0
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'done'

export function describeDue(
  dueIso: string | null,
  done: boolean,
): { label: string; tone: DueTone } | null {
  if (!dueIso) return null
  if (done) return { label: formatDay(dueIso), tone: 'done' }
  const days = daysUntil(dueIso)
  if (days < 0)
    return { label: days === -1 ? '1 day overdue' : `${-days} days overdue`, tone: 'overdue' }
  if (days === 0) return { label: 'Due today', tone: 'today' }
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' }
  if (days <= 6) return { label: `Due in ${days} days`, tone: 'soon' }
  return { label: `Due ${formatDay(dueIso)}`, tone: 'later' }
}

export function rangeLabel(startIso: string, endIso: string) {
  const start = parseISO(startIso)
  const end = parseISO(endIso)
  if (startIso === endIso) return format(start, 'MMM d')
  if (isSameMonth(start, end)) return `${format(start, 'MMM d')} – ${format(end, 'd')}`
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

export function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
