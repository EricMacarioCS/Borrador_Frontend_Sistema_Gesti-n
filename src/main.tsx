import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import './styles/tokens.css'
import './styles/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BootError from './app/BootError'
import { loadConfig } from './app/config'
import { createAppRouter } from './app/router'
import { ConfigContext, createServices, ServicesContext } from './app/services'
import { useSessionStore } from './app/stores/session'
import { ApiError } from './shared/lib/errors'

const root = createRoot(document.getElementById('root')!)

async function start() {
  const config = await loadConfig()
  const store = useSessionStore.getState()

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        // Los errores 4xx no se reintentan; los temporales ya los reintenta el cliente HTTP.
        retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500)
      },
      mutations: { retry: false }
    }
  })

  const router = createAppRouter()

  // Si el servidor da la sesión por terminada, se limpia todo y se pide acceso de nuevo.
  const services = await createServices(config, () => {
    useSessionStore.getState().expire()
    queryClient.clear()
    if (router.state.location.pathname !== '/acceso') void router.navigate('/acceso')
  })

  store.init(services, await services.auth.getSession())
  if (useSessionStore.getState().session.user) await store.loadReference()

  root.render(
    <StrictMode>
      <ConfigContext value={config}>
        <ServicesContext value={services}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ServicesContext>
      </ConfigContext>
    </StrictMode>
  )
  sessionStorage.removeItem('cp-admin-reloaded')
}

start().catch((error: unknown) => {
  console.error('No se pudo iniciar la aplicación', error)
  root.render(<BootError error={error} />)
})
