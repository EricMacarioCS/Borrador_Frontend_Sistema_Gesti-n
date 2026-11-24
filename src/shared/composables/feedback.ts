import { reactive } from 'vue'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'

/* Avisos breves */

export interface Toast {
  id: number
  text: string
  tone: 'success' | 'error' | 'info'
  /** Acción opcional, por ejemplo "Deshacer". */
  action?: { label: string; run: () => void }
}
export const toasts = reactive<Toast[]>([])
let nextToast = 1

export function toast(text: string, tone: Toast['tone'] = 'success', action?: Toast['action']) {
  const item: Toast = { id: nextToast++, text, tone, action }
  toasts.push(item)
  setTimeout(() => dismissToast(item.id), action ? 10000 : tone === 'error' ? 7000 : 4000)
}

/** Aviso de error a partir de cualquier falla: el texto sale del código, nunca del mensaje técnico. */
export function toastError(error: unknown) {
  toast(errorMessage(toApiError(error)), 'error')
}

export function dismissToast(id: number) {
  const index = toasts.findIndex(item => item.id === id)
  if (index >= 0) toasts.splice(index, 1)
}

/* Confirmaciones accesibles (sustituyen a window.confirm) */

export interface ConfirmRequest {
  title: string
  text: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

export const confirmState = reactive<{ request: ConfirmRequest | null; resolve: ((value: boolean) => void) | null }>({
  request: null, resolve: null
})

export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  confirmState.resolve?.(false)
  return new Promise(resolve => {
    confirmState.request = request
    confirmState.resolve = resolve
  })
}

export function answerConfirm(value: boolean) {
  confirmState.resolve?.(value)
  confirmState.request = null
  confirmState.resolve = null
}
