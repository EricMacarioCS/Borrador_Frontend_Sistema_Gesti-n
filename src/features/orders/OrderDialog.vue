<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys, useOrder } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { FOOD_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/domain/labels'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import StateView from '@/shared/ui/StateView.vue'
import { confirmAction, toast, toastError } from '@/shared/composables/feedback'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { newIdempotencyKey } from '@/shared/lib/ids'
import { formatMoney } from '@/shared/lib/money'

const props = defineProps<{ orderId: string | null }>()
const emit = defineEmits<{ close: []; open: [id: string] }>()
const store = useSessionStore()
const { orders } = useServices()
const queryClient = useQueryClient()
const id = useId()
const order = useOrder(() => props.orderId)
const reason = ref('')
let cancelKey = newIdempotencyKey()

watch(() => props.orderId, () => {
  reason.value = ''
  cancelKey = newIdempotencyKey()
})

const detail = computed(() => order.data.value)
// Cuando el reembolso termina, la lista también debe mostrar el estado nuevo.
watch(() => detail.value?.status, (status, before) => {
  if (before && status !== before) void queryClient.invalidateQueries({ queryKey: keys.allOrders() })
})
const linkedText = (count: number) => count === 1 ? '1 pedido de dulcería ligado' : `${count} pedidos de dulcería ligados`
const canManage = computed(() => store.can('orders.manage'))
const NEXT: Record<string, string> = { paid: 'Pasar a preparación', preparing: 'Marcar listo', ready: 'Marcar entregado' }

function refresh() {
  void queryClient.invalidateQueries({ queryKey: keys.allOrders() })
  void queryClient.invalidateQueries({ queryKey: keys.activity() })
}

const cancel = useMutation({
  mutationFn: () => orders.cancel(props.orderId!, reason.value.trim(), cancelKey),
  onSuccess: updated => {
    queryClient.setQueryData(keys.order(updated.id), updated)
    refresh()
    toast('Cancelación registrada. El reembolso está en proceso.')
  },
  onError: toastError
})

async function confirmCancel() {
  const d = detail.value
  if (!d || !reason.value.trim()) return
  const others = d.cancellation.affectedIds.length - 1
  const ok = await confirmAction({
    title: 'Cancelar y reembolsar',
    text: `Se reembolsará el total de este pedido (${formatMoney(d.totalCents)})${others > 0 ? ` y de ${linkedText(others)}, que también se cancela${others === 1 ? '' : 'n'}` : ''}. No se puede deshacer.`,
    confirmLabel: 'Cancelar pedido', danger: true
  })
  if (ok) cancel.mutate()
}

const advance = useMutation({
  mutationFn: () => orders.advanceFood(props.orderId!),
  onSuccess: updated => {
    queryClient.setQueryData(keys.order(updated.id), updated)
    refresh()
    toast(`Pedido: ${FOOD_STATUS_LABELS[updated.foodStatus!].toLowerCase()}.`)
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="!!orderId" :label="detail?.ticketCode ?? detail?.id ?? 'Pedido'" :eyebrow="detail ? `${detail.kind === 'tickets' ? 'Boletos' : 'Dulcería'} · ${detail.complexName}` : 'Pedido'"
    size="large" :dirty="!!reason.trim()" @close="emit('close')">
    <StateView :loading="order.isPending.value" :error="order.error.value" skeleton="rows" @retry="order.refetch()">
      <template v-if="detail">
        <div class="status">
          <span class="pill" :class="detail.status === 'confirmed' ? 'success' : detail.status === 'refund-pending' ? 'warning' : detail.status === 'payment-pending' ? 'info' : 'muted'">{{ ORDER_STATUS_LABELS[detail.status] }}</span>
          <span v-if="detail.foodStatus && detail.status === 'confirmed'" class="pill info">{{ FOOD_STATUS_LABELS[detail.foodStatus] }}</span>
          <span class="muted small">{{ detail.channel === 'online' ? 'Venta en línea' : 'Taquilla' }} · {{ formatDateTime(detail.createdAt) }}</span>
        </div>
        <dl class="detail">
          <div><dt>Cliente</dt><dd>{{ detail.customerName }} · {{ detail.customerEmail }}</dd></div>
          <div v-if="detail.screening"><dt>Función</dt><dd>{{ detail.screening.movieTitle }} · {{ formatDate(detail.screening.date) }} a las {{ detail.screening.startTime }}</dd></div>
          <div v-if="detail.screening"><dt>Sala</dt><dd>{{ detail.screening.room }} · {{ detail.screening.projection }} · {{ detail.screening.language }}</dd></div>
          <div v-if="detail.linkedTicketCode"><dt>Folio de boletos</dt><dd>{{ detail.linkedTicketCode }}</dd></div>
          <div v-if="detail.pickup"><dt>Recolección</dt><dd>{{ detail.pickup === 'before' ? 'Antes de la función' : 'Durante la función' }}</dd></div>
          <div><dt>Pago</dt><dd>{{ detail.paymentMethod }}</dd></div>
        </dl>

        <table class="data lines">
          <thead><tr><th>Concepto</th><th>Detalle</th><th class="num">Importe</th></tr></thead>
          <tbody>
            <tr v-for="(ticket, i) in detail.tickets" :key="`t${i}`"><td>Boleto {{ ticket.ticketType }}</td><td>Asiento {{ ticket.seat }}</td><td class="num">{{ formatMoney(ticket.priceCents) }}</td></tr>
            <tr v-for="(item, i) in detail.items" :key="`i${i}`"><td>{{ item.quantity }} × {{ item.name }}</td><td>{{ item.detail }}</td><td class="num">{{ formatMoney(item.totalCents) }}</td></tr>
          </tbody>
          <tfoot>
            <tr v-if="detail.totals.discountCents"><td colspan="2">{{ detail.promotionName ?? 'Descuento' }}</td><td class="num">−{{ formatMoney(detail.totals.discountCents) }}</td></tr>
            <tr v-if="detail.totals.serviceFeeCents"><td colspan="2">Cargo por servicio</td><td class="num">{{ formatMoney(detail.totals.serviceFeeCents) }}</td></tr>
            <tr><td colspan="2">Total cobrado</td><td class="num">{{ formatMoney(detail.totals.totalCents) }}</td></tr>
          </tfoot>
        </table>

        <div v-if="detail.cancelReason" class="notice spaced">
          <strong>Cancelado:</strong> {{ detail.cancelReason }}. Reembolso de {{ formatMoney(detail.refund.amountCents) }}
          {{ detail.refund.status === 'completed' ? 'completado' : 'en proceso' }}.
        </div>

        <template v-if="detail.linkedOrders.length">
          <h3 class="subheading">Pedidos ligados</h3>
          <ul class="linked" role="list">
            <li v-for="linked in detail.linkedOrders" :key="linked.id">
              <button type="button" class="link-btn" @click="emit('open', linked.id)">{{ linked.ticketCode ?? linked.id }}</button>
              · {{ linked.kind === 'tickets' ? 'Boletos' : 'Dulcería' }} · {{ ORDER_STATUS_LABELS[linked.status] }}
            </li>
          </ul>
        </template>

        <div v-if="canManage && detail.cancellation.allowed" class="field cancel">
          <label :for="`${id}-reason`">Motivo, si vas a cancelar</label>
          <input :id="`${id}-reason`" v-model="reason" class="input" maxlength="300" />
          <p v-if="detail.cancellation.affectedIds.length > 1" class="field-hint">También se cancela {{ linkedText(detail.cancellation.affectedIds.length - 1) }} que aún no se prepara.</p>
        </div>
        <p v-else-if="detail.status === 'confirmed' && detail.cancellation.reason" class="notice small spaced">{{ detail.cancellation.reason }}</p>
      </template>
    </StateView>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cerrar</button>
      <button v-if="canManage && detail?.foodStatus && detail.status === 'confirmed' && NEXT[detail.foodStatus]" type="button" class="btn btn-secondary"
        :disabled="advance.isPending.value" @click="advance.mutate()">{{ NEXT[detail.foodStatus] }}</button>
      <button v-if="canManage && detail?.cancellation.allowed" type="button" class="btn btn-danger" :disabled="!reason.trim() || cancel.isPending.value" @click="confirmCancel">Cancelar y reembolsar</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.status { margin-bottom: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.detail { display: grid; gap: 8px; margin-bottom: 16px; }
.detail div { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; }
.detail dt { color: var(--muted); font-size: 13px; }
.detail dd { margin: 0; }
.lines { border: 1px solid var(--line); border-radius: var(--radius-s); }
.spaced { margin-top: 14px; }
.subheading { margin: 18px 0 8px; font: 700 15px var(--font-title); }
.linked { display: grid; gap: 4px; }
.cancel { margin-top: 18px; }
@media (max-width: 600px) { .detail div { grid-template-columns: minmax(0, 1fr); gap: 0; } }
</style>
