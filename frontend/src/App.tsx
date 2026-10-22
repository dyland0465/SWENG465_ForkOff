import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { appRoutes } from './routes/routes'
import { AuthProvider } from './features/auth/AuthProvider'
import './App.css'

const router = createBrowserRouter(appRoutes)

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App