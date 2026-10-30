import { generatePath, useNavigate } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { PartnerAccountAccess } from '../features/partner/PartnerAccountAccess'
import { partnerDemoEnabled, usePartnerDemoPreview } from '../features/partner/partnerDemoPreviewState'
import { paths } from '../routes/paths'
import './PartnerAccessPage.css'

export function PartnerAccessPage() {
  const navigate = useNavigate()
  const preview = usePartnerDemoPreview()

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
            <li>Review engagement with restaurant promotions.</li>
          </ul>
        </section>

        <PartnerAccountAccess />
      </div>

      {partnerDemoEnabled && <section className="partner-access__demo" aria-labelledby="partner-demo-title" aria-describedby="partner-demo-description">
        <p className="text-label-default">Demo preview</p>
        <h2 id="partner-demo-title" className="text-heading-h2">Explore Partner Analytics</h2>
        <p id="partner-demo-description">This demo preview uses synthetic sample data only. It does not sign you in or provide access to real restaurant information. No password is needed.</p>
        <Button variant="secondary" onClick={() => { preview.start(); navigate(generatePath(paths.partnerRestaurant, { restaurantId: 'harbor' })) }}>
          Preview Demo Dashboard
        </Button>
      </section>}

      <TextAction to={paths.home}>Back to Home</TextAction>
    </main>
  )
}
