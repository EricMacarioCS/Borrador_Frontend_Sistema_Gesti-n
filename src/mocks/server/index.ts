/**
 * Servidor simulado. Aplica las reglas que debe garantizar el backend real: sesión y permisos, CSRF,
 * concurrencia optimista, idempotencia, validaciones y planeación de funciones sin traslapes.
 */
import { load, save } from '../store'
import { seedState } from '../seed'
import { dispatch, type MockRequest, type MockResponse } from './core'
import './routes-catalog'
import './routes-commerce'
import './routes-admin'

export type { MockRequest, MockResponse }

export function handle(request: MockRequest, now = Date.now()): MockResponse {
  const state = load(seedState)
  const { response, changed } = dispatch(state, request, now)
  if (changed) save(state)
  return response
}
