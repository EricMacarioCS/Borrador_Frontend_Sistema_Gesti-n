/**
 * Ventana basada en <dialog>: el navegador da foco atrapado, Esc y fondo inerte.
 * Con `dirty`, cerrar sin guardar pide confirmación para no perder lo capturado por accidente.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { confirmAction } from '@/shared/hooks/feedback'
import './BaseDialog.css'

interface Props {
  open: boolean
  label: string
  size?: 'small' | 'medium' | 'large' | 'wide'
  dirty?: boolean
  eyebrow?: string
  /** Sustituye al título por defecto. */
  header?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  onClose: () => void
}

export default function BaseDialog({ open, label, size = 'medium', dirty = false, eyebrow, header, footer, children, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const pressedBackdrop = useRef(false)
  const latest = useRef({ open, dirty, onClose })
  useEffect(() => { latest.current = { open, dirty, onClose } })

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      opener.current = document.activeElement as HTMLElement | null
      element.showModal()
      document.documentElement.style.overflow = 'hidden'
      element.querySelector<HTMLElement>('[data-autofocus], .dialog-body :is(input, select, textarea, button):not(:disabled)')?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  useEffect(() => {
    const element = dialog.current
    return () => {
      if (element?.open) {
        element.close()
        if (!document.querySelector('dialog[open]')) document.documentElement.style.overflow = ''
      }
    }
  }, [])

  async function requestClose() {
    if (latest.current.dirty) {
      const discard = await confirmAction({ title: '¿Descartar los cambios?', text: 'Lo que capturaste en esta ventana no se ha guardado.', confirmLabel: 'Descartar', danger: true })
      if (!discard) return
    }
    latest.current.onClose()
  }

  function onClosed() {
    if (!document.querySelector('dialog[open]')) document.documentElement.style.overflow = ''
    if (opener.current?.isConnected) opener.current.focus()
    if (latest.current.open) latest.current.onClose()
  }

  return (
    <dialog ref={dialog} className={`dialog dialog-${size}`} aria-label={label}
      onCancel={event => { event.preventDefault(); void requestClose() }}
      onClose={onClosed}
      // Solo un clic que empieza y termina en el fondo cierra; seleccionar texto y soltar fuera no.
      onMouseDown={event => { pressedBackdrop.current = event.target === dialog.current }}
      onClick={event => {
        if (pressedBackdrop.current && event.target === dialog.current) void requestClose()
        pressedBackdrop.current = false
      }}>
      {open && (
        <div className="dialog-panel">
          <header className="dialog-header">
            <div className="titles">
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              {header ?? <h2>{label}</h2>}
            </div>
            <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => void requestClose()}><X size={20} /></button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
