/**
 * PartnerBadge.tsx
 *
 * Small "Fork Off partner" label shown on restaurants that have an approved
 * partner (see backend/src/services/partnerListings.ts). Used on the voting card
 * and the results page.
 */
import './PartnerBadge.css'

export function PartnerBadge() {
  return (
    <span className="partner-badge" title="The owner or manager of this restaurant is a verified Fork Off partner.">
      <span aria-hidden="true">✓</span> Fork Off partner
    </span>
  )
}