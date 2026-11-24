<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pencil, Plus, Search } from '@lucide/vue'
import EmployeeDialog from './EmployeeDialog.vue'
import RoleDialog from './RoleDialog.vue'
import { useEmployees, useRoles } from '@/app/queries'
import { useSessionStore } from '@/app/stores/session'
import { EMPLOYEE_STATUS_LABELS } from '@/domain/labels'
import type { Employee, EmployeeStatus, Role } from '@/domain/models'
import StateView from '@/shared/ui/StateView.vue'
import { normalizeText } from '@/shared/lib/text'

const store = useSessionStore()
const employees = useEmployees()
const roles = useRoles()
const tab = ref<'staff' | 'roles'>('staff')
const search = ref('')
const complexId = ref('')
const roleId = ref('')
const status = ref<EmployeeStatus | ''>('active')
const editing = ref<{ employee: Employee | null } | null>(null)
const editingRole = ref<{ role: Role | null } | null>(null)

const roleName = (id: string) => roles.data.value?.find(r => r.id === id)?.name ?? '—'
const fullName = (e: Employee) => [e.firstName, e.lastName, e.secondLastName].filter(Boolean).join(' ')
const shown = computed(() => (employees.data.value ?? [])
  .filter(e => (!complexId.value || e.complexId === complexId.value) && (!roleId.value || e.roleId === roleId.value) && (!status.value || e.status === status.value))
  .filter(e => normalizeText(`${fullName(e)} ${e.email ?? ''} ${roleName(e.roleId)} ${store.complexName(e.complexId)}`).includes(normalizeText(search.value)))
  .sort((a, b) => store.complexName(a.complexId).localeCompare(store.complexName(b.complexId)) || a.lastName.localeCompare(b.lastName)))
const tone = (s: EmployeeStatus) => s === 'active' ? 'success' : s === 'leave' ? 'warning' : 'muted'
const initials = (e: Employee) => `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase()
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Empleados</h1>
        <p>Personal de los complejos. Los salarios solo se muestran al editar un registro.</p>
      </div>
      <button v-if="tab === 'staff'" type="button" class="btn btn-primary" :disabled="!roles.data.value?.length" @click="editing = { employee: null }"><Plus :size="16" /> Registrar empleado</button>
      <button v-else type="button" class="btn btn-primary" @click="editingRole = { role: null }"><Plus :size="16" /> Nuevo puesto</button>
    </div>

    <div class="tabs" role="tablist" aria-label="Secciones de personal">
      <button type="button" role="tab" :aria-selected="tab === 'staff'" @click="tab = 'staff'">Personal</button>
      <button type="button" role="tab" :aria-selected="tab === 'roles'" @click="tab = 'roles'">Puestos</button>
    </div>

    <template v-if="tab === 'staff'">
      <div class="toolbar">
        <div class="field grow search">
          <label for="emp-buscar">Buscar</label>
          <Search :size="17" aria-hidden="true" />
          <input id="emp-buscar" v-model="search" class="input" type="search" placeholder="Nombre, correo, puesto o complejo" />
        </div>
        <div class="field">
          <label for="emp-complejo">Complejo</label>
          <select id="emp-complejo" v-model="complexId" class="select"><option value="">Todos</option><option v-for="c in store.complexes" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </div>
        <div class="field">
          <label for="emp-puesto">Puesto</label>
          <select id="emp-puesto" v-model="roleId" class="select"><option value="">Todos</option><option v-for="r in roles.data.value" :key="r.id" :value="r.id">{{ r.name }}</option></select>
        </div>
        <div class="field">
          <label for="emp-estado">Estado</label>
          <select id="emp-estado" v-model="status" class="select"><option value="">Todos</option><option v-for="(label, value) in EMPLOYEE_STATUS_LABELS" :key="value" :value="value">{{ label }}</option></select>
        </div>
        <span class="count">{{ shown.length }} personas</span>
      </div>
      <StateView :loading="employees.isPending.value" :error="employees.error.value" :empty="!shown.length" skeleton="rows" empty-title="Sin resultados" @retry="employees.refetch()">
        <div class="panel table-wrap">
          <table class="data">
            <thead><tr><th>Empleado</th><th>Puesto</th><th>Complejo</th><th>Contacto</th><th>Estado</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="e in shown" :key="e.id">
                <td><span class="person"><span class="avatar" aria-hidden="true">{{ initials(e) }}</span><strong>{{ fullName(e) }}</strong></span></td>
                <td>{{ roleName(e.roleId) }}</td>
                <td>{{ store.complexName(e.complexId) }}</td>
                <td><span class="stack"><span>{{ e.email ?? '—' }}</span><small>{{ e.phone ?? '' }}</small></span></td>
                <td><span class="pill" :class="tone(e.status)">{{ EMPLOYEE_STATUS_LABELS[e.status] }}</span></td>
                <td class="actions-col"><button type="button" class="action" :aria-label="`Editar a ${fullName(e)}`" @click="editing = { employee: e }"><Pencil :size="15" /> Editar</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </StateView>
    </template>

    <StateView v-else :loading="roles.isPending.value" :error="roles.error.value" skeleton="rows" @retry="roles.refetch()">
      <div class="panel table-wrap">
        <table class="data">
          <thead><tr><th>Puesto</th><th>Área</th><th>Mando</th><th>Responsabilidades</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="r in roles.data.value" :key="r.id">
              <td><strong>{{ r.name }}</strong></td>
              <td>{{ r.area || '—' }}</td>
              <td>{{ r.isManager ? 'Sí' : 'No' }}</td>
              <td>{{ r.responsibilities || '—' }}</td>
              <td class="actions-col"><button type="button" class="action" :aria-label="`Editar ${r.name}`" @click="editingRole = { role: r }"><Pencil :size="15" /> Editar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </StateView>

    <EmployeeDialog :open="!!editing" :employee="editing?.employee ?? null" @close="editing = null" />
    <RoleDialog :open="!!editingRole" :role="editingRole?.role ?? null" @close="editingRole = null" />
  </section>
</template>

<style scoped>
.toolbar .search svg { top: auto; bottom: 11px; transform: none; }
.person { display: flex; align-items: center; gap: 10px; }
.avatar { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--selection); color: var(--blue); font-size: 12px; font-weight: 700; }
</style>
