import { Check, CircleAlert, Info, X } from 'lucide-react'
import BaseDialog from '@/shared/ui/BaseDialog'
import { answerConfirm, dismissToast, useFeedback } from '@/shared/hooks/feedback'
import './FeedbackHost.css'

export default function FeedbackHost() {
  const toasts = useFeedback(state => state.toasts)
  const request = useFeedback(state => state.confirm?.request)

  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map(item => (
          <div key={item.id} className={`toast ${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
            <span className="icon">{item.tone === 'error' ? <CircleAlert size={16} /> : item.tone === 'info' ? <Info size={16} /> : <Check size={16} />}</span>
            <span className="text">{item.text}</span>
            {item.action && <button type="button" className="undo" onClick={() => { item.action?.run(); dismissToast(item.id) }}>{item.action.label}</button>}
            <button type="button" className="close" aria-label="Cerrar aviso" onClick={() => dismissToast(item.id)}><X size={16} /></button>
          </div>
        ))}
      </div>

      <BaseDialog
        open={!!request}
        label={request?.title ?? 'Confirmar'}
        size="small"
        onClose={() => answerConfirm(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => answerConfirm(false)}>{request?.cancelLabel ?? 'Volver'}</button>
          <button type="button" className={`btn ${request?.danger ? 'btn-danger' : 'btn-primary'}`} data-autofocus onClick={() => answerConfirm(true)}>
            {request?.confirmLabel}
          </button>
        </>}
      >
        <p className="confirm-text">{request?.text}</p>
      </BaseDialog>
    </>
  )
}
