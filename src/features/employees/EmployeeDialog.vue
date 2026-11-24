<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys, useRoles } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { EMPLOYEE_STATUS_LABELS } from '@/domain/labels'
import type { Employee, EmployeeStatus } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import MoneyInput from '@/shared/ui/MoneyInput.vue'
import { toast, toastError } from '@/shared/composables/feedback'
import { addDays } from '@/shared/lib/datetime'

const props = defineProps<{ open: boolean; employee: Employee | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { employees } = useServices()
const roles = useRoles()
const queryClient = useQueryClient()
const id = useId()

interface Draft {
  firstName: string; lastName: string; secondLastName: string; email: string; phone: string; birthDate: string; hiredOn: string
  salaryCents: number | null; status: EmployeeStatus; complexId: string; roleId: string
}
const blank = (): Draft => ({
  firstName: '', lastName: '', secondLastName: '', email: '', phone: '', birthDate: '', hiredOn: store.today(), salaryCents: null, status: 'active',
  complexId: store.complexes[0]?.id ?? '', roleId: roles.data.value?.[0]?.id ?? ''
})
const draft = ref<Draft>(blank())
let original = ''
const touched = ref(false)

watch(() => props.open, open => {
  if (!open) return
  const e = props.employee
  draft.value = e ? { ...e, secondLastName: e.secondLastName ?? '', email: e.email ?? '', phone: e.phone ?? '' } : blank()
  original = JSON.stringify(draft.value)
  touched.value = false
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original)
const errors = computed(() => {
  const d = draft.value
  return {
    name: d.firstName.trim() && d.lastName.trim() ? null : 'Escribe el nombre y el apellido paterno.',
    email: !d.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) ? null : 'Escribe un correo válido.',
    phone: !d.phone.trim() || /^\d{10}$/.test(d.phone.trim()) ? null : 'El teléfono tiene 10 dígitos.',
    birth: d.birthDate && d.birthDate <= addDays(d.hiredOn || store.today(), -16 * 365) ? null : 'Debe tener al menos 16 años al contratarse.',
    salary: d.salaryCents !== null && d.salaryCents > 0 ? null : 'Escribe el salario mensual.',
    assignment: d.complexId && d.roleId ? null : 'Elige el complejo y el puesto.'
  }
})
const valid = computed(() => Object.values(errors.value).every(e => !e))
const show = (key: keyof typeof errors.value) => touched.value ? errors.value[key] : null

const save = useMutation({
  mutationFn: () => {
    const d = draft.value
    const input = {
      firstName: d.firstName.trim(), lastName: d.lastName.trim(), secondLastName: d.secondLastName.trim() || null, email: d.email.trim().toLowerCase() || null,
      phone: d.phone.trim() || null, birthDate: d.birthDate, hiredOn: d.hiredOn, salaryCents: d.salaryCents!, status: d.status, complexId: d.complexId, roleId: d.roleId
    }
    return props.employee ? employees.update(props.employee.id, { ...input, version: props.employee.version }) : employees.create(input)
  },
  onSuccess: employee => {
    void queryClient.invalidateQueries({ queryKey: keys.employees() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`${employee.firstName} ${employee.lastName} se guardó.`)
    emit('close')
  },
  onError: toastError
})
function submit() {
  touched.value = true
  if (valid.value) save.mutate()
}
</script>

<template>
  <BaseDialog :open="open" :label="employee ? `Editar a ${employee.firstName} ${employee.lastName}` : 'Registrar empleado'" eyebrow="Personal" size="large" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="submit">
      <h3 class="form-section">Datos personales</h3>
      <div class="field"><label :for="`${id}-first`">Nombre *</label><input :id="`${id}-first`" v-model="draft.firstName" class="input" maxlength="60" autocomplete="off" /></div>
      <div class="field"><label :for="`${id}-last`">Apellido paterno *</label><input :id="`${id}-last`" v-model="draft.lastName" class="input" maxlength="60" autocomplete="off" /></div>
      <div class="field"><label :for="`${id}-second`">Apellido materno</label><input :id="`${id}-second`" v-model="draft.secondLastName" class="input" maxlength="60" autocomplete="off" /></div>
      <div class="field">
        <label :for="`${id}-birth`">Fecha de nacimiento *</label>
        <input :id="`${id}-birth`" v-model="draft.birthDate" class="input" type="date" />
        <p class="field-error">{{ show('birth') }}</p>
      </div>
      <p class="field-error full">{{ show('name') }}</p>
      <div class="field">
        <label :for="`${id}-email`">Correo</label>
        <input :id="`${id}-email`" v-model="draft.email" class="input" type="email" autocomplete="off" />
        <p class="field-error">{{ show('email') }}</p>
      </div>
      <div class="field">
        <label :for="`${id}-phone`">Teléfono</label>
        <input :id="`${id}-phone`" v-model="draft.phone" class="input" inputmode="tel" maxlength="10" autocomplete="off" />
        <p class="field-error">{{ show('phone') }}</p>
      </div>

      <h3 class="form-section">Puesto</h3>
      <div class="field">
        <label :for="`${id}-complex`">Complejo *</label>
        <select :id="`${id}-complex`" v-model="draft.complexId" class="select">
          <option v-for="c in store.complexes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-role`">Puesto *</label>
        <select :id="`${id}-role`" v-model="draft.roleId" class="select">
          <option v-for="r in roles.data.value" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-hired`">Fecha de contratación *</label>
        <input :id="`${id}-hired`" v-model="draft.hiredOn" class="input" type="date" />
      </div>
      <div class="field">
        <label :for="`${id}-salary`">Salario mensual *</label>
        <MoneyInput :id="`${id}-salary`" v-model="draft.salaryCents" />
        <p class="field-error">{{ show('salary') }}</p>
      </div>
      <div class="field">
        <label :for="`${id}-status`">Estado</label>
        <select :id="`${id}-status`" v-model="draft.status" class="select">
          <option v-for="(label, value) in EMPLOYEE_STATUS_LABELS" :key="value" :value="value">{{ label }}</option>
        </select>
        <p class="field-hint">Los empleados no se borran: tienen turnos y ventas ligadas. Se dan de baja.</p>
      </div>
      <p class="field-error full">{{ show('assignment') }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="save.isPending.value">Guardar</button>
    </template>
  </BaseDialog>
</template>
