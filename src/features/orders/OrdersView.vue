<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, ReceiptText, Search } from '@lucide/vue'
import OrderDialog from './OrderDialog.vue'
import { useOrders } from '@/app/queries'
import { useSessionStore } from '@/app/stores/session'
import { FOOD_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/domain/labels'
import type { OrderQuery, OrderStatus } from '@/domain/models'
import StateView from '@/shared/ui/StateView.vue'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'

const store = useSessionStore()
const typed = ref('')
const search = ref('')
const complexId = ref('')
const status = ref<OrderStatus | ''>('')
const kind = ref<'tickets' | 'food' | ''>('')
const page = ref(1)
const selected = ref<string | null>(null)

// Se espera a que termine de escribir para no consultar en cada tecla.
let timer: ReturnType<typeof setTimeout> | undefined
watch(typed, value => {
  clearTimeout(timer)
  timer = setTimeout(() => { search.value = value.trim() }, 350)
})
watch([search, complexId, status, kind], () => { page.value = 1 })

const query = computed<OrderQuery>(() => ({
  search: search.value || undefined, complexId: complexId.value || undefined, status: status.value || undefined, kind: kind.value || undefined,
  page: page.value, pageSize: 20
}))
const orders = useOrders(query)
const pages = computed(() => Math.max(1, Math.ceil((orders.data.value?.total ?? 0) / 20)))
const tone = (s: OrderStatus) => s === 'confirmed' ? 'success' : s === 'refund-pending' ? 'warning' : s === 'payment-pending' ? 'info' : s === 'payment-failed' ? 'danger' : 'muted'
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Pedidos</h1>
        <p>Busca por folio, correo o nombre. Desde el detalle puedes cancelar con reembolso o avanzar los pedidos de dulcería.</p>
      </div>
    </div>

    <div class="panel filters">
      <div class="field search grow">
        <label for="pedido-buscar">Buscar</label>
        <Search :size="17" aria-hidden="true" />
        <input id="pedido-buscar" v-model="typed" class="input" type="search" placeholder="Folio CIN-…, correo o nombre" />
      </div>
      <div class="field">
        <label for="pedido-complejo">Complejo</label>
        <select id="pedido-complejo" v-model="complexId" class="select">
          <option value="">Todos</option>
          <option v-for="c in store.complexes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="field">
        <label for="pedido-tipo">Tipo</label>
        <select id="pedido-tipo" v-model="kind" class="select">
          <option value="">Todos</option>
          <option value="tickets">Boletos</option>
          <option value="food">Dulcería</option>
        </select>
      </div>
      <div class="field">
        <label for="pedido-estado">Estado</label>
        <select id="pedido-estado" v-model="status" class="select">
          <option value="">Todos</option>
          <option v-for="(label, value) in ORDER_STATUS_LABELS" :key="value" :value="value">{{ label }}</option>
        </select>
      </div>
    </div>

    <StateView :loading="orders.isPending.value" :error="orders.error.value" :empty="!orders.data.value?.items.length" skeleton="rows"
      empty-title="No se encontraron pedidos" empty-text="Revisa el folio o cambia los filtros." @retry="orders.refetch()">
      <div class="panel table-wrap" :class="{ refreshing: orders.isPlaceholderData.value }">
        <table class="data">
          <thead><tr><th>Folio</th><th>Tipo</th><th>Cliente</th><th>Complejo</th><th>Fecha</th><th class="num">Total</th><th>Estado</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="order in orders.data.value?.items" :key="order.id">
              <td><span class="stack"><strong class="code">{{ order.ticketCode ?? order.id }}</strong><small v-if="order.linkedTicketCode">Ligado a {{ order.linkedTicketCode }}</small></span></td>
              <td>{{ order.kind === 'tickets' ? 'Boletos' : 'Dulcería' }}<small v-if="order.channel === 'box-office'" class="muted"> · taquilla</small></td>
              <td><span class="stack"><span>{{ order.customerName }}</span><small>{{ order.customerEmail }}</small></span></td>
              <td>{{ order.complexName }}</td>
              <td>{{ formatDateTime(order.createdAt) }}</td>
              <td class="num">{{ formatMoney(order.totalCents) }}</td>
              <td>
                <span class="tags">
                  <span class="pill" :class="tone(order.status)">{{ ORDER_STATUS_LABELS[order.status] }}</span>
                  <span v-if="order.foodStatus && order.status === 'confirmed'" class="pill info">{{ FOOD_STATUS_LABELS[order.foodStatus] }}</span>
                </span>
              </td>
              <td class="actions-col"><button type="button" class="action" :aria-label="`Ver pedido ${order.ticketCode ?? order.id}`" @click="selected = order.id"><ReceiptText :size="15" /> Ver</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav class="pager" aria-label="Páginas de pedidos">
        <span class="count">{{ orders.data.value?.total ?? 0 }} pedidos · página {{ page }} de {{ pages }}</span>
        <button type="button" class="btn btn-secondary btn-small" :disabled="page <= 1" @click="page--"><ChevronLeft :size="15" /> Anterior</button>
        <button type="button" class="btn btn-secondary btn-small" :disabled="page >= pages" @click="page++">Siguiente <ChevronRight :size="15" /></button>
      </nav>
    </StateView>

    <OrderDialog :order-id="selected" @close="selected = null" @open="selected = $event" />
  </section>
</template>

<style scoped>
.filters { margin-bottom: 16px; padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 14px; }
.filters .field { min-width: 160px; }
.filters .grow { flex: 1 1 260px; }
.filters .search svg { top: auto; bottom: 11px; transform: none; }
.code { font-variant-numeric: tabular-nums; letter-spacing: .02em; white-space: nowrap; }
.refreshing { opacity: .6; }
.pager { margin-top: 12px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.pager .count { margin-right: auto; }
</style>
