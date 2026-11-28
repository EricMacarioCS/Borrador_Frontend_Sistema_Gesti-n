import { create } from 'zustand'
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

/* Confirmaciones accesibles (sustituyen a window.confirm) */

export interface ConfirmRequest {
  title: string
  text: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

interface FeedbackState {
  toasts: Toast[]
  confirm: { request: ConfirmRequest; resolve: (value: boolean) => void } | null
}

export const useFeedback = create<FeedbackState>()(() => ({ toasts: [], confirm: null }))
let nextToast = 1

export function toast(text: string, tone: Toast['tone'] = 'success', action?: Toast['action']) {
  const item: Toast = { id: nextToast++, text, tone, action }
  useFeedback.setState(state => ({ toasts: [...state.toasts, item] }))
  setTimeout(() => dismissToast(item.id), action ? 10000 : tone === 'error' ? 7000 : 4000)
}

/** Aviso de error a partir de cualquier falla: el texto sale del código, nunca del mensaje técnico. */
export function toastError(error: unknown) {
  toast(errorMessage(toApiError(error)), 'error')
}

export function dismissToast(id: number) {
  useFeedback.setState(state => ({ toasts: state.toasts.filter(item => item.id !== id) }))
}

export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  useFeedback.getState().confirm?.resolve(false)
  return new Promise(resolve => useFeedback.setState({ confirm: { request, resolve } }))
}

export function answerConfirm(value: boolean) {
  useFeedback.getState().confirm?.resolve(value)
  useFeedback.setState({ confirm: null })
}
