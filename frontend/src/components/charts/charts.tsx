import { format, parseISO } from 'date-fns'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { useMediaQuery } from '@/hooks/use-utils'
import type { TrendPoint } from '@/lib/api/types'
import { rangeLabel } from '@/lib/dates'
import { plural } from '@/lib/utils'
import { TREND_SERIES, type TrendSeries } from './series'

const axisTick = { fill: 'var(--subtle)', fontSize: 11.5 }

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as TrendPoint | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-border-strong bg-raised px-3 py-2 text-[12px] shadow-pop">
      <p className="mb-1 font-medium text-foreground">
        Week of {rangeLabel(point.week_start, point.week_end)}
      </p>
      <p className="text-muted">
        <span className="font-medium text-foreground tabular">{point.completed}</span> completed
      </p>
      <p className="text-muted">
        <span className="font-medium text-foreground tabular">{point.remaining}</span> still open at
        week end
      </p>
      <p className="text-muted">
        <span className="font-medium text-foreground tabular">{point.created}</span> created
      </p>
      <p className="mt-1 text-subtle">Click a bar to see its completed tasks</p>
    </div>
  )
}

/** Weekly completed bars with a "still open" line; bars are clickable. */
export function CompletionTrendChart({
  points,
  selectedIndex,
  onSelect,
  hidden,
  height = 240,
  showCreated = false,
}: {
  points: TrendPoint[]
  selectedIndex: number
  onSelect: (index: number) => void
  hidden: ReadonlySet<TrendSeries>
  height?: number
  showCreated?: boolean
}) {
  const animate = !useMediaQuery('(prefers-reduced-motion: reduce)')
  const data = points.map((point) => ({
    ...point,
    label: format(parseISO(point.week_start), 'MMM d'),
  }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} minTickGap={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} width={40} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={(props) => <TrendTooltip {...props} />}
        />
        {!hidden.has('completed') ? (
          <Bar
            dataKey="completed"
            name={TREND_SERIES.completed.label}
            radius={[5, 5, 1, 1]}
            maxBarSize={30}
            cursor="pointer"
            isAnimationActive={animate}
            animationDuration={600}
            onClick={(_data, index) => onSelect(index)}
          >
            {data.map((point, index) => (
              <Cell
                key={point.week_start}
                fill="var(--primary)"
                fillOpacity={selectedIndex < 0 || index === selectedIndex ? 1 : 0.45}
              />
            ))}
          </Bar>
        ) : null}
        {showCreated && !hidden.has('created') ? (
          <Line
            dataKey="created"
            name={TREND_SERIES.created.label}
            type="monotone"
            stroke="var(--status-todo)"
            strokeWidth={1.75}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={animate}
            animationDuration={600}
          />
        ) : null}
        {!hidden.has('remaining') ? (
          <Line
            dataKey="remaining"
            name={TREND_SERIES.remaining.label}
            type="monotone"
            stroke="var(--violet)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: 'var(--violet)', strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={animate}
            animationDuration={600}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Toggle buttons that double as the chart legend. */
export function SeriesToggles({
  series,
  hidden,
  onToggle,
}: {
  series: TrendSeries[]
  hidden: ReadonlySet<TrendSeries>
  onToggle: (series: TrendSeries) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Chart series">
      {series.map((key) => {
        const visible = !hidden.has(key)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={visible}
            onClick={() => onToggle(key)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground aria-[pressed=false]:opacity-50"
            title={
              visible
                ? `Hide ${TREND_SERIES[key].label.toLowerCase()}`
                : `Show ${TREND_SERIES[key].label.toLowerCase()}`
            }
          >
            <span
              className={key === 'completed' ? 'size-2.5 rounded-[3px]' : 'h-0.5 w-3 rounded-full'}
              style={{ background: TREND_SERIES[key].color }}
              aria-hidden
            />
            {TREND_SERIES[key].label}
          </button>
        )
      })}
    </div>
  )
}

export interface Slice {
  key: string
  label: string
  count: number
  color: string
}

function SliceTooltip({ active, payload, total }: TooltipContentProps & { total: number }) {
  const slice = payload?.[0]?.payload as Slice | undefined
  if (!active || !slice) return null
  return (
    <div className="rounded-lg border border-border-strong bg-raised px-3 py-2 text-[12px] shadow-pop">
      <p className="font-medium text-foreground">{slice.label}</p>
      <p className="text-muted">
        {plural(slice.count, 'task')} ({total ? Math.round((slice.count / total) * 100) : 0}%)
      </p>
    </div>
  )
}

/** Donut chart; clicking a segment selects it (the parent decides where that leads). */
export function DonutChart({
  slices,
  total,
  centerLabel,
  onSelect,
  height = 196,
}: {
  slices: Slice[]
  total: number
  centerLabel: string
  onSelect: (key: string) => void
  height?: number
}) {
  const animate = !useMediaQuery('(prefers-reduced-motion: reduce)')
  const visible = slices.filter((slice) => slice.count > 0)
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={visible}
            dataKey="count"
            nameKey="label"
            innerRadius="64%"
            outerRadius="92%"
            paddingAngle={visible.length > 1 ? 2 : 0}
            stroke="var(--surface)"
            strokeWidth={2}
            cursor="pointer"
            isAnimationActive={animate}
            animationDuration={600}
            onClick={(data) => {
              const slice = data.payload as Slice | undefined
              if (slice) onSelect(slice.key)
            }}
          >
            {visible.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip content={(props) => <SliceTooltip {...props} total={total} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] leading-none font-semibold font-display text-foreground tabular">
          {total}
        </span>
        <span className="mt-1 text-[11.5px] text-subtle">{centerLabel}</span>
      </div>
    </div>
  )
}
