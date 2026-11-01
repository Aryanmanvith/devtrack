import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach } from 'vitest'

// Pages are lazy-loaded exactly as in the browser, so the first test in a file also waits for
// the page's code to import. On slow or busy machines that can exceed the 1s default.
configure({ asyncUtilTimeout: 5000 })

// jsdom does not implement a few browser APIs that Radix UI, sonner and React Router use.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

window.scrollTo = (() => {}) as typeof window.scrollTo
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}

afterEach(() => {
  // sonner keeps toasts in a module-level store; clear it so tests stay independent.
  toast.dismiss()
  cleanup()
  window.localStorage.clear()
})
