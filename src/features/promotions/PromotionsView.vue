<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pencil, Plus } from '@lucide/vue'
import ClubLevelDialog from './ClubLevelDialog.vue'
import PromotionDialog from './PromotionDialog.vue'
import { useClubLevels, usePromotions } from '@/app/queries'
import { useSessionStore } from '@/app/stores/session'
import { PROMOTION_LABELS, WEEKDAYS, labelOf } from '@/domain/labels'
import type { ClubLevel, Promotion } from '@/domain/models'
import StateView from '@/shared/ui/StateView.vue'
import { formatDate } from '@/shared/lib/datetime'

const store = useSessionStore()
const promotions = usePromotions()
const levels = useClubLevels()
const tab = ref<'promotions' | 'club'>('promotions')
const editing = ref<{ promotion: Promotion | null } | null>(null)
const editingLevel = ref<ClubLevel | null>(null)

function state(p: Promotion) {
  const today = store.today()
  if (p.validTo && p.validTo < today) return { label: 'Vencida', tone: 'muted' }
  return p.validFrom > today ? { label: 'Programada', tone: 'info' } : { label: 'Vigente', tone: 'success' }
}
const sorted = computed(() => [...(promotions.data.value ?? [])].sort((a, b) => Number(state(a).label === 'Vencida') - Number(state(b).label === 'Vencida') || a.name.localeCompare(b.name)))
const levelName = (id: string | null) => id ? levels.data.value?.find(l => l.id === id)?.name ?? '—' : 'Todo público'
const formats = (p: Promotion) => [
  ...p.rules.roomTypes.map(code => store.reference?.roomTypes.find(t => t.code === code)?.name ?? code),
  ...p.rules.projections.map(code => store.reference?.projections.find(x => x.code === code)?.name ?? code)
].join(', ') || 'Todos'
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Promociones y Club</h1>
        <p>Una promoción por compra. Las del Club pueden limitarse a un nivel de socio.</p>
      </div>
      <button v-if="tab === 'promotions'" type="button" class="btn btn-primary" @click="editing = { promotion: null }"><Plus :size="16" /> Nueva promoción</button>
    </div>

    <div class="tabs" role="tablist" aria-label="Secciones">
      <button type="button" role="tab" :aria-selected="tab === 'promotions'" @click="tab = 'promotions'">Promociones</button>
      <button type="button" role="tab" :aria-selected="tab === 'club'" @click="tab = 'club'">Niveles del Club</button>
    </div>

    <StateView v-if="tab === 'promotions'" :loading="promotions.isPending.value" :error="promotions.error.value" :empty="!sorted.length" skeleton="rows"
      empty-title="Sin promociones" @retry="promotions.refetch()">
      <div class="panel table-wrap">
        <table class="data">
          <thead><tr><th>Promoción</th><th>Tipo</th><th>Días</th><th>Formatos</th><th>Complejos</th><th>Socios</th><th>Vigencia</th><th>Estado</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="p in sorted" :key="p.id" :class="{ 'row-off': state(p).label === 'Vencida' }">
              <td><span class="stack"><strong>{{ p.name }}</strong><small>{{ p.description }}</small></span></td>
              <td>{{ p.kind === 'percent' ? `${p.rules.percent} % de descuento` : labelOf(PROMOTION_LABELS, p.kind) }}</td>
              <td>{{ p.rules.weekdays.length ? p.rules.weekdays.map(d => WEEKDAYS[d]).join(', ') : 'Todos' }}</td>
              <td>{{ formats(p) }}</td>
              <td>{{ p.appliesToAll ? 'Toda la cadena' : `${p.complexIds.length} ${p.complexIds.length === 1 ? 'complejo' : 'complejos'}` }}</td>
              <td>{{ levelName(p.clubLevelId) }}</td>
              <td>{{ formatDate(p.validFrom, 'short') }} – {{ p.validTo ? formatDate(p.validTo, 'short') : 'sin fin' }}</td>
              <td><span class="pill" :class="state(p).tone">{{ state(p).label }}</span></td>
              <td class="actions-col"><button type="button" class="action" :aria-label="`Editar ${p.name}`" @click="editing = { promotion: p }"><Pencil :size="15" /> Editar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </StateView>

    <StateView v-else :loading="levels.isPending.value" :error="levels.error.value" skeleton="rows" @retry="levels.refetch()">
      <p class="notice small spaced">Los niveles se calculan con las visitas del semestre (tabla <code>nivel_club</code>). Las cuentas de los socios no se administran aquí.</p>
      <div class="levels">
        <article v-for="level in levels.data.value" :key="level.id" class="panel panel-pad level">
          <h2>{{ level.name }}</h2>
          <p class="muted">{{ level.maxVisits === null ? `${level.minVisits} visitas o más` : `De ${level.minVisits} a ${level.maxVisits} visitas` }} por semestre</p>
          <p><strong>{{ level.pointsPercent }} %</strong> del gasto en puntos</p>
          <p class="small">{{ level.benefits || 'Sin beneficios descritos.' }}</p>
          <button type="button" class="action" :aria-label="`Editar ${level.name}`" @click="editingLevel = level"><Pencil :size="15" /> Editar</button>
        </article>
      </div>
    </StateView>

    <PromotionDialog :open="!!editing" :promotion="editing?.promotion ?? null" @close="editing = null" />
    <ClubLevelDialog :level="editingLevel" @close="editingLevel = null" />
  </section>
</template>

<style scoped>
.spaced { margin-bottom: 12px; }
.levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.level { display: grid; gap: 6px; justify-items: start; }
.level h2 { font: 700 18px var(--font-title); }
code { font-size: 12px; }
</style>
