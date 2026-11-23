import { PartnerAccountAccess } from '../features/partner/PartnerAccountAccess'
import './PartnerAccessPage.css'

export function PartnerAccessPage() {
  return (
    <main id="main-content" className="partner-access" tabIndex={-1}>
      <header className="partner-access__intro">
        <p className="partner-access__audience text-label-default">For restaurant owners and managers</p>
        <h1 className="text-heading-h1">Partner access</h1>
        <p className="text-body-large">See how dining groups find and choose your restaurant on Fork Off.</p>
      </header>

      <PartnerAccountAccess />

      <section className="partner-access__benefits" aria-labelledby="partner-benefits-title">
        <h2 id="partner-benefits-title" className="text-heading-h2">What you can track</h2>
        <dl>
          <div>
            <dt>Discovery</dt>
            <dd>How often your restaurant appears in group voting rounds.</dd>
          </div>
          <div>
            <dt>Voting</dt>
            <dd>How groups vote and how often you finish first.</dd>
          </div>
          <div>
            <dt>Engagement</dt>
            <dd>How often diners save your restaurant or open it in Google Maps.</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
