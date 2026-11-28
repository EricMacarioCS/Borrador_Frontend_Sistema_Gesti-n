import { useState } from 'react'

/**
 * Ejecuta `onOpen` durante el render en que `open` pasa a verdadero: es el momento de
 * reiniciar el estado de una ventana sin un efecto ni un render de más.
 */
export function useOnOpen(open: boolean, onOpen: () => void) {
  const [previous, setPrevious] = useState(false)
  if (open !== previous) {
    setPrevious(open)
    if (open) onOpen()
  }
}

/**
 * Borrador de un formulario dentro de una ventana: se reinicia con `init` cada vez que se abre,
 * sabe si tiene cambios sin guardar y si ya se intentó enviar (para mostrar errores).
 */
export function useDraft<T>(open: boolean, init: () => T) {
  const [draft, setDraft] = useState<T>(init)
  const [original, setOriginal] = useState(() => JSON.stringify(draft))
  const [touched, setTouched] = useState(false)
  useOnOpen(open, () => {
    const fresh = init()
    setDraft(fresh)
    setOriginal(JSON.stringify(fresh))
    setTouched(false)
  })
  const update = (patch: Partial<T>) => setDraft(current => ({ ...current, ...patch }))
  return { draft, setDraft, update, dirty: JSON.stringify(draft) !== original, touched, setTouched }
}

/**
 * Estado local que se vuelve a calcular con `derive` cuando cambia alguna dependencia
 * (por ejemplo, la respuesta del servidor). Entre cambios, el usuario lo edita libremente.
 */
export function useSyncedState<T>(deps: readonly unknown[], derive: () => T) {
  const [state, setState] = useState<T>(derive)
  const [seen, setSeen] = useState(deps)
  if (deps.length !== seen.length || deps.some((dep, i) => !Object.is(dep, seen[i]))) {
    setSeen(deps)
    setState(derive())
  }
  return [state, setState] as const
}

/** Valor de un campo numérico: vacío o inválido queda como `NaN` para que la validación lo marque. */
export const numberValue = (value: number) => (Number.isFinite(value) ? value : '')
