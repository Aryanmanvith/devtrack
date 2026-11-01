import { useCallback } from 'react'
import { positiveInt } from '@/lib/filters'
import { useSearchParamState } from './use-utils'

/**
 * Task and issue details open in a drawer addressed by the URL (?task=12 or ?issue=4),
 * so any page can open them, they survive reloads and the back button closes them.
 */
function useDrawer(key: 'task' | 'issue') {
  const [value, set] = useSearchParamState(key)
  const id = positiveInt(value)
  const open = useCallback((entityId: number) => set(entityId), [set])
  const close = useCallback(() => set(null, { replace: true }), [set])
  return { id, open, close }
}

export const useTaskDrawer = () => useDrawer('task')
export const useIssueDrawer = () => useDrawer('issue')
