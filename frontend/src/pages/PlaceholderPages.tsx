import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'

type PlaceholderPageProps = {
  title: string
  backTo?: string
  backLabel?: string
}

function PlaceholderPage({
  title,
  backTo = paths.home,
  backLabel = 'Back to home',
}: PlaceholderPageProps) {
  return (
    <main id="main-content" className="route-placeholder" tabIndex={-1}>
      <h1 className="text-heading-h1">{title}</h1>
      <p className="text-body-large">This screen is coming soon.</p>
      <TextAction to={backTo}>{backLabel}</TextAction>
    </main>
  )
}

export function PartnerRestaurantPage() {
  return <PlaceholderPage title="Partner restaurant" />
}

export function NotFoundPage() {
  return (
    <main id="main-content" className="route-placeholder" tabIndex={-1}>
      <h1 className="text-heading-h1">Page not found</h1>
      <p className="text-body-large">We couldn’t find that page.</p>
      <TextAction to={paths.home}>Back to home</TextAction>
    </main>
  )
}
