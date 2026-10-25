import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'

export function NotFoundPage() {
  return (
    <main id="main-content" className="route-placeholder" tabIndex={-1}>
      <h1 className="text-heading-h1">Page not found</h1>
      <p className="text-body-large">We couldn’t find that page.</p>
      <TextAction to={paths.home}>Back to home</TextAction>
    </main>
  )
}
