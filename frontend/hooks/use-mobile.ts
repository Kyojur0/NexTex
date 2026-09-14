import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
function subscribe(callback: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const snapshot = () => window.matchMedia(query).matches
const serverSnapshot = () => false
export function useIsMobile() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot) }
