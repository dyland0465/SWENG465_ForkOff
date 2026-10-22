import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { appRoutes } from './routes/routes'
import { AuthProvider } from './features/auth/AuthProvider'
import './App.css'
// A data router enables the shared ScrollRestoration and preventScrollReset support.
const router = createBrowserRouter(appRoutes)

function App() {
  <AuthProvider>
    return <RouterProvider router={router} />
  </AuthProvider>
}

export default App