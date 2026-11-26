<script setup lang="ts">
import { computed } from 'vue'
import { Building2, Server, ShieldCheck } from '@lucide/vue'
import { NAV_ITEMS } from '@/app/navigation'
import { useConfig, useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'

const store = useSessionStore()
const config = useConfig()
const services = useServices()
const modules = computed(() => NAV_ITEMS.filter(item => store.can(item.permission)).map(item => item.label))
const version = __APP_VERSION__
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Configuración</h1>
        <p>Tu cuenta, el ambiente en el que trabajas y los datos generales de la organización.</p>
      </div>
    </div>

    <div class="grid">
      <article class="panel panel-pad card">
        <span class="metric-icon"><ShieldCheck :size="18" /></span>
        <h2>Tu cuenta</h2>
        <dl>
          <div><dt>Nombre</dt><dd>{{ store.session.user?.name }}</dd></div>
          <div><dt>Correo</dt><dd>{{ store.session.user?.email }}</dd></div>
          <div><dt>Puesto</dt><dd>{{ store.session.user?.roleName }}</dd></div>
          <div><dt>Alcance</dt><dd>{{ store.session.complexIds === null ? 'Toda la cadena' : store.complexes.map(c => c.name).join(', ') }}</dd></div>
          <div><dt>Módulos</dt><dd>{{ modules.join(', ') }}</dd></div>
          <div><dt>Cierre por inactividad</dt><dd>{{ config.idleMinutes ? `${config.idleMinutes} minutos` : 'Desactivado' }}</dd></div>
        </dl>
      </article>

      <article class="panel panel-pad card">
        <span class="metric-icon violet"><Server :size="18" /></span>
        <h2>Ambiente</h2>
        <dl>
          <div><dt>Nombre</dt><dd>{{ config.environmentName }}</dd></div>
          <div><dt>Datos</dt><dd><span class="pill" :class="services.mode === 'mock' ? 'warning' : 'success'">{{ services.mode === 'mock' ? 'Simulados en el navegador' : 'API conectada' }}</span></dd></div>
          <div><dt>API</dt><dd><code>{{ config.apiBaseUrl }}</code></dd></div>
          <div><dt>Versión</dt><dd>{{ version }}</dd></div>
          <div v-if="config.supportEmail"><dt>Soporte</dt><dd><a :href="`mailto:${config.supportEmail}`">{{ config.supportEmail }}</a></dd></div>
        </dl>
      </article>

      <article class="panel panel-pad card">
        <span class="metric-icon success"><Building2 :size="18" /></span>
        <h2>Organización</h2>
        <dl>
          <div><dt>Administración</dt><dd>Centralizada por cadena, con gerentes por complejo</dd></div>
          <div><dt>Complejos visibles</dt><dd>{{ store.complexes.length }}</dd></div>
          <div><dt>Ciudades</dt><dd>{{ store.reference?.cities.map(c => c.name).join(', ') }}</dd></div>
          <div><dt>Moneda</dt><dd>Peso mexicano (MXN)</dd></div>
          <div><dt>Zona horaria</dt><dd>Centro de México (America/Mexico_City)</dd></div>
        </dl>
      </article>
    </div>
  </section>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 16px; }
.card { display: grid; gap: 10px; align-content: start; }
.card h2 { font: 700 var(--text-l) var(--font-title); }
dl { display: grid; gap: 10px; }
dl div { display: grid; gap: 2px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
dl div:last-child { border-bottom: 0; }
dt { color: var(--muted); font-size: var(--text-xs); font-weight: 600; }
dd { margin: 0; }
code { font-size: var(--text-s); overflow-wrap: anywhere; }
</style>
