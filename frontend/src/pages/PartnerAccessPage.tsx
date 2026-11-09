import { TextAction } from '../components/ui/TextAction'
import { PartnerAccountAccess } from '../features/partner/PartnerAccountAccess'
import { paths } from '../routes/paths'
import './PartnerAccessPage.css'

export function PartnerAccessPage() {
  return (
    <main id="main-content" className="partner-access" tabIndex={-1}>
      <div className="partner-access__intro">
        <p className="text-label-default">Fork Off! for Restaurants</p>
        <h1 className="text-heading-h1">Partner access</h1>
        <p className="text-body-large">From group discovery to dinner, decided. A clearer view of how diners connect with your restaurant.</p>
      </div>

      <div className="partner-access__content">
        <section className="partner-access__benefits" aria-labelledby="partner-benefits-title">
          <h2 id="partner-benefits-title" className="text-heading-h2">Insights for your restaurant</h2>
          <ul>
            <li>Understand how often dining groups discover your restaurant.</li>
            <li>Explore aggregate voting trends and group selections.</li>
            <li>Review restaurant saves and map engagement.</li>
          </ul>
        </section>

        <PartnerAccountAccess />
      </div>

      <TextAction to={paths.home}>Back to Home</TextAction>
    </main>
  )
}
