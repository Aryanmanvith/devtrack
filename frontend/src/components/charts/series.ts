export type TrendSeries = 'completed' | 'remaining' | 'created'

export const TREND_SERIES: Record<TrendSeries, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'var(--primary)' },
  remaining: { label: 'Still open', color: 'var(--violet)' },
  created: { label: 'Created', color: 'var(--status-todo)' },
}
