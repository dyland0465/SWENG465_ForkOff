/**
 * AdminPage.tsx
 *
 * The admin screen at /admin, for reviewing restaurant partner sign-ups.
 * Admins reach it through the normal login (they're sent here automatically)
 * or the "Admin" tab in the header, which only admins can see.
 *
 *  - Filter partners by Pending / Approved / Rejected / All.
 *  - Each partner card shows who they are and the restaurant they claimed.
 *  - Approve: search Google for that restaurant (or paste a Google Place ID),
 *    pick the right one, and approve. That links the restaurant to the partner.
 *  - Reject: marks them rejected and removes any restaurant access.
 *
 * Non-admins who open /admin see a "no access" message. The real protection is
 * on the server: every /api/admin route returns 403 unless the account is an admin.
 */
import { useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { FilterChip } from '../components/ui/FilterChip'
import { TextInput } from '../components/ui/FormField'
import { TextAction } from '../components/ui/TextAction'
import { useAuth } from '../features/auth/useAuth'
import { approvePartner, listPartners, rejectPartner, searchPlaces } from '../features/admin/adminApi'
import type { AdminPartner, PartnerFilter, PlaceResult } from '../features/admin/adminApi'
import { paths } from '../routes/paths'
import './AdminPage.css'

const filters: { value: PartnerFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

export function AdminPage() {
  const { user, loading } = useAuth()

  if (loading) return <main id="main-content" className="admin-page" tabIndex={-1}><p role="status">Checking session…</p></main>
  if (!user || user.role !== 'admin') {
    return (
      <main id="main-content" className="admin-page" tabIndex={-1}>
        <h1 className="text-heading-h1">Admin</h1>
        <p className="text-body-large">{user ? 'Your account doesn’t have access to this page.' : 'Log in with an admin account to continue.'}</p>
        {user ? <TextAction to={paths.home}>Back to home</TextAction> : <TextAction to={paths.login} state={{ from: paths.admin }}>Log in</TextAction>}
      </main>
    )
  }
  return <PartnerReview />
}

// The partner list, with filters. Reloads whenever the filter changes.
function PartnerReview() {
  const [filter, setFilter] = useState<PartnerFilter>('pending')
  const [partners, setPartners] = useState<AdminPartner[] | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listPartners(filter, controller.signal)
      .then(result => { setPartners(result); setError('') })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load partners.') })
    return () => controller.abort()
  }, [filter, reload])

  // After approving/rejecting, update the card (or drop it if it no longer matches the filter).
  function onChanged(updated: AdminPartner) {
    setPartners(current => (current ?? [])
      .map(partner => partner.id === updated.id ? updated : partner)
      .filter(partner => filter === 'all' || partner.status === filter))
  }

  return (
    <main id="main-content" className="admin-page" tabIndex={-1}>
      <div className="admin-page__intro">
        <p className="text-label-default">Admin</p>
        <h1 className="text-heading-h1">Partner requests</h1>
        <p className="text-body-large">Review restaurant partner sign-ups. Approving links the partner to their restaurant’s insights.</p>
      </div>

      <div className="admin-page__filters" role="group" aria-label="Filter partners by status">
        {filters.map(option => (
          <FilterChip key={option.value} selected={filter === option.value} onClick={() => { setFilter(option.value); setPartners(null) }}>{option.label}</FilterChip>
        ))}
        <Button variant="secondary" onClick={() => { setPartners(null); setReload(value => value + 1) }}>Refresh</Button>
      </div>

      <div role="status" aria-live="polite" className="admin-page__status">
        {error ? <p className="admin-page__error">{error}</p>
          : partners === null ? <p>Loading partners…</p>
          : partners.length === 0 ? <p>No {filter === 'all' ? '' : `${filter} `}partner accounts.</p>
          : <p>{partners.length} {partners.length === 1 ? 'partner' : 'partners'}</p>}
      </div>

      <ul className="admin-page__list">
        {partners?.map(partner => <li key={partner.id}><PartnerCard partner={partner} onChanged={onChanged} /></li>)}
      </ul>
    </main>
  )
}

// One partner: details, plus the approve (restaurant search) and reject controls.
function PartnerCard({ partner, onChanged }: { partner: AdminPartner; onChanged: (partner: AdminPartner) => void }) {
  const claimed = [partner.requestedRestaurant.name, partner.requestedRestaurant.address].filter(Boolean).join(', ')
  const [query, setQuery] = useState(claimed)
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const [placeId, setPlaceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong.') } finally { setBusy(false) }
  }

  const search = () => run(async () => {
    const places = await searchPlaces(query)
    setResults(places)
    setPlaceId(places[0]?.placeId ?? '')
    if (places.length === 0) setMessage('No restaurants found. Try a different search or paste a Google Place ID.')
  })
  const approve = () => run(async () => onChanged(await approvePartner(partner.id, placeId.trim())))
  const reject = () => run(async () => onChanged(await rejectPartner(partner.id)))
  const titleId = `partner-${partner.id}-name`

  return (
    <article className="admin-card" aria-labelledby={titleId}>
      <header className="admin-card__header">
        <div>
          <h2 id={titleId} className="text-heading-h2">{partner.username}</h2>
          <p>{partner.email}{partner.createdAt && <> · Signed up {new Date(partner.createdAt).toLocaleDateString()}</>}</p>
        </div>
        <span className={`admin-card__badge admin-card__badge--${partner.status}`}>{partner.status}</span>
      </header>

      <dl className="admin-card__details">
        <div><dt>Claimed restaurant</dt><dd>{partner.requestedRestaurant.name || '—'}</dd></div>
        <div><dt>Address</dt><dd>{partner.requestedRestaurant.address || '—'}</dd></div>
        <div><dt>Linked restaurants</dt><dd>{partner.restaurantIds.length}</dd></div>
      </dl>

      {partner.status !== 'approved' && (
        <div className="admin-card__approve">
          <form className="admin-card__search" onSubmit={event => { event.preventDefault(); if (query.trim()) void search() }}>
            <TextInput label="Find the restaurant on Google" name="query" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} />
            <Button type="submit" variant="secondary" disabled={busy || !query.trim()}>Search</Button>
          </form>

          {results && results.length > 0 && (
            <fieldset className="admin-card__results" disabled={busy}>
              <legend className="text-label-default">Pick the matching restaurant</legend>
              {results.map(place => (
                <label key={place.placeId} className="admin-card__result">
                  <input type="radio" name={`place-${partner.id}`} value={place.placeId} checked={placeId === place.placeId} onChange={() => setPlaceId(place.placeId)} />
                  <span><strong>{place.name}</strong><br />{place.address}</span>
                </label>
              ))}
            </fieldset>
          )}

          <TextInput label="Google Place ID" name="placeId" hint="Filled in when you pick a result above, or paste one yourself." value={placeId} disabled={busy} spellCheck={false} autoCapitalize="none" onChange={event => setPlaceId(event.target.value)} />
        </div>
      )}

      <div className="admin-card__actions">
        {partner.status !== 'approved' && <Button disabled={busy || !placeId.trim()} onClick={() => void approve()}>{busy ? 'Saving…' : 'Approve'}</Button>}
        {partner.status !== 'rejected' && <Button variant="secondary" disabled={busy} onClick={() => void reject()}>{partner.status === 'approved' ? 'Revoke access' : 'Reject'}</Button>}
      </div>
      <p className="admin-card__message" role="status">{message}</p>
    </article>
  )
}