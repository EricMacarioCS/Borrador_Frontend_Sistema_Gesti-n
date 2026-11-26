<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff, LogIn } from '@lucide/vue'
import { firstAllowed } from '@/app/navigation'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'

const store = useSessionStore()
const services = useServices()
const route = useRoute()
const router = useRouter()
const id = useId()
const email = ref('')
const password = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

const notice = computed(() => store.endedReason === 'idle'
  ? 'Cerramos tu sesión por inactividad.'
  : store.endedReason === 'expired' ? 'Tu sesión terminó. Vuelve a entrar.' : null)

async function submit() {
  error.value = null
  if (!email.value.trim() || !password.value) {
    error.value = 'Escribe tu correo y tu contraseña.'
    return
  }
  busy.value = true
  try {
    await store.signIn(email.value.trim(), password.value)
    password.value = ''
    // Solo se continúa a rutas internas, nunca a una dirección externa.
    const next = typeof route.query.siguiente === 'string' && route.query.siguiente.startsWith('/') && !route.query.siguiente.startsWith('//') ? route.query.siguiente : null
    await router.replace(next ?? firstAllowed(store.can)?.path ?? '/sin-acceso')
  } catch (caught) {
    error.value = errorMessage(toApiError(caught))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="intro">
      <div class="brand"><span class="mark" aria-hidden="true">c</span><span><strong>cinépolis</strong><small>Administración</small></span></div>
      <p class="headline">Gestión de la cadena y de sus complejos</p>
      <p class="lead">Cartelera, funciones, dulcería, tarifas, promociones, contenido del sitio y personal en un solo sistema.</p>
    </div>
    <div class="access">
    <section class="card panel" aria-labelledby="titulo-acceso">
      <h1 id="titulo-acceso">Inicia sesión</h1>
      <p class="muted">Sistema interno para el personal autorizado.</p>
      <p v-if="notice" class="notice warning" role="status">{{ notice }}</p>
      <form class="form" novalidate @submit.prevent="submit">
        <div class="field">
          <label :for="`${id}-email`">Correo</label>
          <input :id="`${id}-email`" v-model="email" class="input" type="email" autocomplete="username" autofocus :aria-invalid="error ? 'true' : undefined" />
        </div>
        <div class="field">
          <label :for="`${id}-password`">Contraseña</label>
          <div class="password">
            <input :id="`${id}-password`" v-model="password" class="input" :type="show ? 'text' : 'password'" autocomplete="current-password" :aria-invalid="error ? 'true' : undefined" />
            <button type="button" class="icon-btn" :aria-label="show ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="show = !show">
              <EyeOff v-if="show" :size="18" /><Eye v-else :size="18" />
            </button>
          </div>
        </div>
        <p v-if="error" class="notice danger" role="alert">{{ error }}</p>
        <button type="submit" class="btn btn-primary btn-block" :disabled="busy"><LogIn :size="18" /> {{ busy ? 'Entrando…' : 'Entrar' }}</button>
      </form>
      <div v-if="services.mode === 'mock'" class="demo">
        <p><strong>Ambiente de demostración.</strong> Cuentas de prueba (contraseña <code>Demo-2026</code>):</p>
        <ul>
          <li><code>admin@cinepolis.test</code>: administrador general.</li>
          <li><code>gerente.xalapa@cinepolis.test</code>: gerente con acceso a dos complejos.</li>
        </ul>
      </div>
    </section>
    </div>
  </div>
</template>

<style scoped>
.login { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); background: var(--surface-soft); }
.intro { padding: clamp(32px, 6vw, 88px); display: grid; align-content: center; gap: 18px; background: var(--navy-950); color: var(--on-dark); }
.access { padding: 32px 16px; display: grid; place-items: center; }
.card { width: min(100%, 420px); padding: 32px; display: grid; gap: 12px; }
.brand { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.brand span:last-child { display: grid; }
.brand strong { font: 700 var(--text-xl)/1.2 var(--font-title); }
.brand small { color: var(--muted-on-dark); font-size: var(--text-xs); font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
.mark { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: var(--radius-s); background: var(--blue); font: italic 800 var(--text-2xl)/1 var(--font-title); }
.headline { max-width: 18ch; font: 800 var(--text-2xl)/1.25 var(--font-title); }
.lead { max-width: 44ch; color: var(--muted-on-dark); font-size: var(--text-l); }
h1 { font: 800 var(--text-xl) var(--font-title); }
.form { margin-top: 8px; display: grid; gap: 14px; }
.password { position: relative; }
.password .input { padding-right: 44px; }
.password .icon-btn { position: absolute; right: 2px; top: 2px; }
.demo { margin-top: 8px; padding: 12px 14px; border-radius: var(--radius-s); background: var(--surface-soft); font-size: var(--text-s); color: var(--muted); overflow-wrap: anywhere; }
.demo ul { margin-top: 6px; padding-left: 18px; }
code { color: var(--ink); font-size: var(--text-xs); }
@media (max-width: 860px) {
  .login { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; }
  .intro { padding: 24px 20px; gap: 8px; }
  .brand { margin-bottom: 4px; }
  .headline { max-width: none; font-size: var(--text-l); }
  .lead { display: none; }
  .access { padding: 20px 16px 32px; place-items: start center; }
  .card { padding: 22px 18px; }
}
</style>
