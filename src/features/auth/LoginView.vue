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
/** Correo o nombre de usuario (`usuario_admin.correo` o `username`). */
const login = ref('')
const password = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

const notice = computed(() => store.endedReason === 'idle'
  ? 'Cerramos tu sesión por inactividad.'
  : store.endedReason === 'expired' ? 'Tu sesión terminó. Vuelve a entrar.' : null)

async function submit() {
  error.value = null
  if (!login.value.trim() || !password.value) {
    error.value = 'Escribe tu correo o usuario y tu contraseña.'
    return
  }
  busy.value = true
  try {
    await store.signIn(login.value.trim(), password.value)
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
    <section class="card panel" aria-labelledby="titulo-acceso">
      <div class="brand"><span class="mark" aria-hidden="true">c</span><span><strong>cinépolis</strong><small>Administración</small></span></div>
      <h1 id="titulo-acceso">Inicia sesión</h1>
      <p class="muted">Sistema interno para el personal autorizado.</p>
      <p v-if="notice" class="notice warning" role="status">{{ notice }}</p>
      <form class="form" novalidate @submit.prevent="submit">
        <div class="field">
          <label :for="`${id}-login`">Correo o usuario</label>
          <input :id="`${id}-login`" v-model="login" class="input" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" autofocus :aria-invalid="error ? 'true' : undefined" />
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
</template>

<style scoped>
.login { min-height: 100dvh; padding: 24px 16px; display: grid; place-items: center; background: var(--navy-950); }
.card { width: min(100%, 420px); padding: 32px; display: grid; gap: 12px; }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.brand span:last-child { display: grid; }
.brand strong { font: 700 22px var(--font-title); }
.brand small { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
.mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; background: var(--blue); color: #fff; font: italic 800 28px/1 var(--font-title); }
h1 { font: 800 24px var(--font-title); }
.form { margin-top: 8px; display: grid; gap: 14px; }
.password { position: relative; }
.password .input { padding-right: 44px; }
.password .icon-btn { position: absolute; right: 2px; top: 2px; }
.demo { margin-top: 8px; padding: 12px 14px; border-radius: var(--radius-s); background: var(--surface-soft); font-size: 13px; color: var(--muted); }
.demo ul { margin-top: 6px; padding-left: 18px; }
code { color: var(--ink); font-size: 12px; }
</style>
