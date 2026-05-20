import { useEffect, useRef } from 'react'

export function useChangeListener(entities: string[], callback: () => void): void {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const handler = (entity: unknown): void => {
      if (!entities.includes(entity as string)) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        cbRef.current()
      }, 100)
    }
    window.api.on('db:changed', handler)
    return () => {
      window.api.off('db:changed', handler)
      if (timer) clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- entities is constant per component instance
}
