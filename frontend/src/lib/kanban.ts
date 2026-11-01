const STEP = 1024

/** Fractional position between two neighbours, so a move only updates the moved task. */
export function positionBetween(before?: number, after?: number) {
  if (before !== undefined && after !== undefined) return (before + after) / 2
  if (before !== undefined) return before + STEP
  if (after !== undefined) return after - STEP
  return STEP
}
