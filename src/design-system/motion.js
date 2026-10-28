import { useSyncExternalStore } from 'react'

const reducedMotionQuery = typeof window === 'undefined'
  ? null
  : window.matchMedia('(prefers-reduced-motion: reduce)')

function subscribe(onChange) {
  reducedMotionQuery?.addEventListener('change', onChange)
  return () => reducedMotionQuery?.removeEventListener('change', onChange)
}

const getSnapshot = () => reducedMotionQuery?.matches ?? true
const getServerSnapshot = () => true

// Share the preference, not an animation layer. Components keep their own motion.
// Subscribe explicitly so an OS preference change also affects mounted charts.
export function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
