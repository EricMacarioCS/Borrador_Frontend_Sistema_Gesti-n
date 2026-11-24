<script setup lang="ts">
import { computed, ref } from 'vue'
import { Armchair, Building2, MapPin, Pencil } from '@lucide/vue'
import ComplexDialog from './ComplexDialog.vue'
import RoomsDialog from './RoomsDialog.vue'
import { useSessionStore } from '@/app/stores/session'
import type { Complex } from '@/domain/models'
import { formatDate } from '@/shared/lib/datetime'

const store = useSessionStore()
const editing = ref<Complex | null>(null)
const roomsOf = ref<Complex | null>(null)

const cities = computed(() => {
  const groups = new Map<string, Complex[]>()
  for (const complex of store.complexes) groups.set(complex.cityName, [...(groups.get(complex.cityName) ?? []), complex])
  return [...groups]
})
const totals = computed(() => ({
  rooms: store.complexes.reduce((sum, c) => sum + c.roomCount, 0),
  seats: store.complexes.reduce((sum, c) => sum + c.seatCount, 0)
}))
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Complejos y salas</h1>
        <p>Datos de cada complejo, sus salas, las proyecciones que admiten y el plano de asientos.</p>
      </div>
    </div>

    <div class="metric-grid spaced">
      <article class="panel metric"><div class="metric-top"><span>Complejos</span><span class="metric-icon"><Building2 :size="17" /></span></div><strong>{{ store.complexes.length }}</strong></article>
      <article class="panel metric"><div class="metric-top"><span>Ciudades</span><span class="metric-icon"><MapPin :size="17" /></span></div><strong>{{ cities.length }}</strong></article>
      <article class="panel metric"><div class="metric-top"><span>Salas</span><span class="metric-icon"><Armchair :size="17" /></span></div><strong>{{ totals.rooms }}</strong></article>
      <article class="panel metric"><div class="metric-top"><span>Asientos</span><span class="metric-icon"><Armchair :size="17" /></span></div><strong>{{ totals.seats.toLocaleString('es-MX') }}</strong></article>
    </div>

    <section v-for="[city, list] in cities" :key="city" class="city" :aria-labelledby="`ciudad-${city}`">
      <h2 :id="`ciudad-${city}`"><MapPin :size="16" aria-hidden="true" /> {{ city }}</h2>
      <div class="grid">
        <article v-for="complex in list" :key="complex.id" class="panel card">
          <div class="top">
            <h3>{{ complex.name }}</h3>
            <span class="pill" :class="complex.kind === 'vip' ? 'info' : 'muted'">{{ complex.kind === 'vip' ? 'VIP' : 'Tradicional' }}</span>
          </div>
          <p class="muted small">{{ complex.address }}, C.P. {{ complex.postalCode }}</p>
          <dl class="stats">
            <div><dt>Salas</dt><dd>{{ complex.roomCount }}</dd></div>
            <div><dt>Asientos</dt><dd>{{ complex.seatCount.toLocaleString('es-MX') }}</dd></div>
            <div><dt>Apertura</dt><dd>{{ formatDate(complex.openedOn, 'short') }}</dd></div>
          </dl>
          <p class="muted small">ID en Vista: {{ complex.vistaId ?? 'sin asignar' }} · /{{ complex.slug }}</p>
          <div class="actions">
            <button type="button" class="btn btn-secondary btn-small" @click="roomsOf = complex"><Armchair :size="15" /> Salas y asientos</button>
            <button type="button" class="action" :aria-label="`Editar datos de ${complex.name}`" @click="editing = complex"><Pencil :size="15" /> Datos</button>
          </div>
        </article>
      </div>
    </section>

    <ComplexDialog :complex="editing" @close="editing = null" />
    <RoomsDialog :complex="roomsOf" @close="roomsOf = null" />
  </section>
</template>

<style scoped>
.spaced { margin-bottom: 20px; }
.city { margin-top: 18px; }
.city h2 { margin-bottom: 10px; display: flex; align-items: center; gap: 6px; color: var(--blue); font: 700 15px var(--font-title); text-transform: uppercase; letter-spacing: .06em; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.card { padding: 16px 18px; display: grid; gap: 10px; align-content: start; }
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.top h3 { font: 700 17px var(--font-title); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px 0; border-block: 1px solid var(--line); }
.stats dt { color: var(--muted); font-size: 12px; }
.stats dd { margin: 0; font: 700 16px var(--font-title); }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
</style>
