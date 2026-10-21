import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { appRoutes } from './routes/routes'
import './App.css'

// A data router enables the shared ScrollRestoration and preventScrollReset support.
const router = createBrowserRouter(appRoutes)

function App() {
  return <RouterProvider router={router} />
}

export default App
