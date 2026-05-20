import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'

type Handler = () => void | Promise<void>

interface Ctx {
  register: (fn: Handler) => () => void
  trigger: () => Promise<void>
}

const RefreshCtx = createContext<Ctx | null>(null)

export function RefreshProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const handlerRef = useRef<Handler | null>(null)

  const register = useCallback((fn: Handler) => {
    handlerRef.current = fn
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null
    }
  }, [])

  const trigger = useCallback(async () => {
    const fn = handlerRef.current
    if (!fn) return
    await fn()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'F5') {
        e.preventDefault()
        void trigger()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [trigger])

  const value = useMemo(() => ({ register, trigger }), [register, trigger])
  return <RefreshCtx.Provider value={value}>{children}</RefreshCtx.Provider>
}

export function useRefreshHandler(fn: Handler): void {
  const ctx = useContext(RefreshCtx)
  useEffect(() => {
    if (!ctx) return
    return ctx.register(fn)
  }, [ctx, fn])
}

export function useTriggerRefresh(): () => Promise<void> {
  const ctx = useContext(RefreshCtx)
  return useCallback(async () => {
    if (ctx) await ctx.trigger()
  }, [ctx])
}
