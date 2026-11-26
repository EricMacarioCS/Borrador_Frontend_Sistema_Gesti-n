import type { Directive } from 'vue'

/**
 * En celular las tablas `.cards` se dibujan como bloques y algunos navegadores dejan de anunciarlas como
 * tabla. Esta directiva declara los roles de forma explícita para conservar la accesibilidad.
 */
function apply(table: HTMLElement) {
  const set = (selector: string, role: string) => {
    for (const element of table.querySelectorAll(selector)) element.setAttribute('role', role)
  }
  table.setAttribute('role', 'table')
  set('thead, tbody, tfoot', 'rowgroup')
  set('tr', 'row')
  set('thead th', 'columnheader')
  set('tbody th:not([scope="colgroup"])', 'rowheader')
  set('tbody th[scope="colgroup"]', 'columnheader')
  set('td', 'cell')
}

export const vTableRoles: Directive<HTMLElement> = { mounted: apply, updated: apply }
