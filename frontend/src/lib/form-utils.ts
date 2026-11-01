import { isBefore, parseISO } from 'date-fns'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from './api/client'

export const isoDateField = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.')

/** Compare calendar dates as dates (not as strings). */
export function isDateBefore(a: string, b: string) {
  return isBefore(parseISO(a), parseISO(b))
}

export function emptyToNull(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** "Front End, testing" → ["front-end", "testing"] (trimmed, lowercased, de-duplicated). */
export function parseLabels(value: string) {
  const labels = value
    .split(',')
    .map((label) => label.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean)
  return [...new Set(labels)]
}

/**
 * Map server-side field errors (for example a duplicate project name) onto form fields.
 * Returns true if at least one field was highlighted.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
) {
  if (!(error instanceof ApiError)) return false
  let applied = false
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !applied })
      applied = true
    }
  }
  return applied
}
