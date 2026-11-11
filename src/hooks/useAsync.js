import { useCallback, useEffect, useRef, useState } from 'react'

/** { data, loading, error, reload, setData } — every page uses this so Loading / Error / Empty states are consistent. */
export function useAsync(fn, deps = [], { interval } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const alive = useRef(true)
  const fnRef = useRef(fn); fnRef.current = fn
  const load = useCallback(async (silent = false) => {
    if (!silent) setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await fnRef.current()
      if (alive.current) setState({ data, loading: false, error: null })
    } catch (error) {
      if (alive.current) setState(s => ({ data: silent ? s.data : null, loading: false, error }))
    }
  }, [])
  useEffect(() => {
    alive.current = true; load()
    const t = interval ? setInterval(() => load(true), interval) : null
    return () => { alive.current = false; if (t) clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  const setData = useCallback((updater) => setState(s => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), [])
  return { ...state, reload: () => load(true), reloadLoud: () => load(false), setData }
}
