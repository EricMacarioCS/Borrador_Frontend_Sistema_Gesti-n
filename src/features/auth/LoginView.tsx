import { useId, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'
import './LoginView.css'

export default function LoginView() {
  const endedReason = useSessionStore(state => state.endedReason)
  const signIn = useSessionStore(state => state.signIn)
  const services = useServices()
  const id = useId()
  /** Correo o nombre de usuario (`usuario_admin.correo` o `username`). */
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notice = endedReason === 'idle'
    ? 'Cerramos tu sesión por inactividad.'
    : endedReason === 'expired' ? 'Tu sesión terminó. Vuelve a entrar.' : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!login.trim() || !password) {
      setError('Escribe tu correo o usuario y tu contraseña.')
      return
    }
    setBusy(true)
    try {
      await signIn(login.trim(), password)
      // Con la sesión abierta, el guardia de `App` lleva a la ruta pedida o al primer módulo permitido.
    } catch (caught) {
      setError(errorMessage(toApiError(caught)))
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <section className="card panel" aria-labelledby="titulo-acceso">
        <div className="brand"><span className="mark" aria-hidden="true">c</span><span><strong>cinépolis</strong><small>Administración</small></span></div>
        <h1 id="titulo-acceso">Inicia sesión</h1>
        <p className="muted">Sistema interno para el personal autorizado.</p>
        {notice && <p className="notice warning" role="status">{notice}</p>}
        <form className="form" noValidate onSubmit={submit}>
          <div className="field">
            <label htmlFor={`${id}-login`}>Correo o usuario</label>
            <input id={`${id}-login`} value={login} onChange={event => setLogin(event.target.value)} className="input" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus aria-invalid={error ? 'true' : undefined} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-password`}>Contraseña</label>
            <div className="password">
              <input id={`${id}-password`} value={password} onChange={event => setPassword(event.target.value)} className="input" type={show ? 'text' : 'password'} autoComplete="current-password" aria-invalid={error ? 'true' : undefined} />
              <button type="button" className="icon-btn" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow(!show)}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="notice danger" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}><LogIn size={18} /> {busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
        {services.mode === 'mock' && (
          <div className="demo">
            <p><strong>Ambiente de demostración.</strong> Cuentas de prueba (contraseña <code>Demo-2026</code>):</p>
            <ul>
              <li><code>admin@cinepolis.test</code>: administrador general.</li>
              <li><code>gerente.xalapa@cinepolis.test</code>: gerente con acceso solo a su complejo.</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
