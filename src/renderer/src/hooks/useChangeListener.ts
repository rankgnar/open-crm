import { useEffect, useRef } from 'react'

export function useChangeListener(entities: string[], callback: () => void): void {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const handler = (entity: unknown): void => {
      if (entities.includes(entity as string)) cbRef.current()
    }
    window.api.on('db:changed', handler)
    return () => window.api.off('db:changed', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- entities is constant per component instance
}
