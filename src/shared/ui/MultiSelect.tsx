/** Selección múltiple con casillas, grupos opcionales y "Seleccionar todo". Se cierra con Esc, al salir del foco o al hacer clic fuera. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import './MultiSelect.css'

export interface MultiOption<V> { value: V; label: string; group?: string; hint?: string; disabled?: boolean }

interface Props<T> {
  label: string
  options: MultiOption<T>[]
  value: T[]
  onChange: (value: T[]) => void
  placeholder?: string
  error?: string | null
  footer?: ReactNode
  className?: string
}

export default function MultiSelect<T extends string | number>({ label, options, value, onChange, placeholder, error, footer, className }: Props<T>) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const selected = options.filter(option => value.includes(option.value))
  const choosable = options.filter(option => !option.disabled)
  const allSelected = choosable.length > 0 && choosable.every(option => value.includes(option.value))
  const groups = new Map<string, MultiOption<T>[]>()
  for (const option of options) groups.set(option.group ?? '', [...(groups.get(option.group ?? '') ?? []), option])
  const summary = !selected.length
    ? placeholder ?? 'Seleccionar…'
    : selected.length <= 2
      ? selected.map(option => option.group ? `${option.group}: ${option.label}` : option.label).join(', ')
      : `${selected.length} seleccionados`

  // Un clic fuera lo cierra. No basta el foco: al presionar sobre un texto el navegador puede
  // mover el foco al contenedor de la página (`main` con tabindex), que envuelve al selector.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function toggle(values: T[], checked: boolean) {
    const others = value.filter(item => !values.includes(item))
    onChange(checked ? [...others, ...values] : others)
  }
  function close() {
    setOpen(false)
    root.current?.querySelector<HTMLButtonElement>('.trigger')?.focus()
  }

  return (
    <div ref={root} className={`field multi${className ? ` ${className}` : ''}`}
      onBlur={event => {
        // Se cierra al pasar con el teclado a otro control; si el foco sube a un contenedor, decide el clic.
        const next = event.relatedTarget as Node | null
        if (next && !root.current?.contains(next) && !next.contains(root.current)) setOpen(false)
      }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return
        event.stopPropagation()
        event.preventDefault()
        close()
      }}>
      <span id={id} className="field-label">{label}</span>
      <div className="control">
        <button type="button" className="trigger" aria-expanded={open} aria-labelledby={`${id} ${id}-value`} aria-invalid={error ? 'true' : undefined} onClick={() => setOpen(!open)}>
          <span id={`${id}-value`} className={selected.length ? undefined : 'placeholder'}>{summary}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        {open && (
          <div className="menu">
            {choosable.length > 1 && (
              <label className="option all">
                <input type="checkbox" checked={allSelected} ref={input => { if (input) input.indeterminate = !allSelected && selected.length > 0 }}
                  onChange={event => toggle(choosable.map(option => option.value), event.target.checked)} />
                <span>Seleccionar todo</span>
              </label>
            )}
            <div className="list">
              {!options.length && <p className="empty-list">No hay opciones disponibles.</p>}
              {[...groups].map(([group, items]) => (
                <div key={group}>
                  {group && (
                    <label className="option group">
                      <input type="checkbox" checked={items.every(option => option.disabled || value.includes(option.value))}
                        onChange={event => toggle(items.filter(option => !option.disabled).map(option => option.value), event.target.checked)} />
                      <span>{group}</span>
                    </label>
                  )}
                  {items.map(option => (
                    <label key={option.value} className={`option${group ? ' nested' : ''}${option.disabled ? ' off' : ''}`}>
                      <input type="checkbox" checked={value.includes(option.value)} disabled={option.disabled}
                        onChange={event => toggle([option.value], event.target.checked)} />
                      <span>{option.label}</span>
                      {option.hint && <small>{option.hint}</small>}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            {footer && <div className="footer">{footer}</div>}
            <div className="done">
              <span>{selected.length} de {choosable.length}</span>
              <button type="button" className="btn btn-primary btn-small" onClick={close}>Listo</button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
