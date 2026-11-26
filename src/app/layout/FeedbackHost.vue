<script setup lang="ts">
import { Check, CircleAlert, Info, X } from '@lucide/vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { answerConfirm, confirmState, dismissToast, toasts } from '@/shared/composables/feedback'
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="item in toasts" :key="item.id" class="toast" :class="item.tone" :role="item.tone === 'error' ? 'alert' : 'status'">
      <span class="icon"><CircleAlert v-if="item.tone === 'error'" :size="16" /><Info v-else-if="item.tone === 'info'" :size="16" /><Check v-else :size="16" /></span>
      <span class="text">{{ item.text }}</span>
      <button v-if="item.action" type="button" class="undo" @click="item.action.run(); dismissToast(item.id)">{{ item.action.label }}</button>
      <button type="button" class="close" aria-label="Cerrar aviso" @click="dismissToast(item.id)"><X :size="16" /></button>
    </div>
  </div>

  <BaseDialog :open="!!confirmState.request" :label="confirmState.request?.title ?? 'Confirmar'" size="small" @close="answerConfirm(false)">
    <p class="confirm-text">{{ confirmState.request?.text }}</p>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="answerConfirm(false)">{{ confirmState.request?.cancelLabel ?? 'Volver' }}</button>
      <button type="button" class="btn" :class="confirmState.request?.danger ? 'btn-danger' : 'btn-primary'" autofocus @click="answerConfirm(true)">
        {{ confirmState.request?.confirmLabel }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.toasts { position: fixed; right: 20px; bottom: 20px; z-index: 3000; display: grid; gap: 10px; width: min(440px, calc(100vw - 40px)); }
.toast { padding: 10px 10px 10px 14px; display: flex; align-items: center; gap: 12px; border-radius: var(--radius-l); background: var(--navy-950); color: var(--on-dark); box-shadow: var(--shadow-float); }
.icon { width: 26px; height: 26px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--success-on-dark); }
.error .icon { background: var(--danger-on-dark); }
.info .icon { background: var(--blue); }
.text { flex: 1; font-size: var(--text-m); }
.undo { padding: 6px 10px; border: 1px solid var(--on-dark-border); border-radius: var(--radius-s); background: transparent; color: var(--on-dark); font-weight: 600; font-size: var(--text-s); }
.undo:hover { background: var(--on-dark-active); }
.close { width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: var(--radius-s); background: transparent; color: var(--muted-on-dark); }
.close:hover { background: var(--on-dark-active); color: var(--on-dark); }
.confirm-text { color: var(--muted); }
</style>
