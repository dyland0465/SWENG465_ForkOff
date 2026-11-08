import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { savedRequest } from '../features/saved/savedApi'
import type { Collection } from '../features/saved/savedApi'
import { RestaurantSearch } from '../features/saved/RestaurantSearch'
import { paths } from '../routes/paths'
import '../features/saved/saved.css'

function PlaceRow({ id, remove }: { id: string; remove: () => void }) {
  const [label, setLabel] = useState('Loading restaurant…')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/places/${encodeURIComponent(id)}`, { signal: controller.signal }).then(async r => { if (!r.ok) throw Error(); const data = await r.json() as { place?: { displayName?: { text?: string } } }; setLabel(data.place?.displayName?.text ?? `Place ${id}`) }).catch(() => { if (!controller.signal.aborted) setLabel(`Place ${id}`) })
    return () => controller.abort()
  }, [id])
  return <li><span>{label}</span><a href={`https://www.google.com/maps/search/?api=1&query=restaurant&query_place_id=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Google Maps</a><button type="button" onClick={remove}>Remove</button></li>
}
function PlaceList({ ids, remove }: { ids: string[]; remove: (id: string) => void }) {
  const [page, setPage] = useState(0)
  const last = Math.max(0, Math.ceil(ids.length / 10) - 1), current = Math.min(page, last)
  return <>{ids.length ? <><ul>{ids.slice(current * 10, current * 10 + 10).map(id => <PlaceRow key={id} id={id} remove={() => remove(id)} />)}</ul>{last > 0 && <div><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button> Page {current + 1} of {last + 1} <button type="button" disabled={current === last} onClick={() => setPage(current + 1)}>Next</button></div>}<small>Restaurant names and links from Google Maps.</small></> : <p>No restaurants saved yet.</p>}</>
}
export function SavedPage() {
  const { user, loading } = useAuth()
  const [favorites, setFavorites] = useState<string[]>([]), [collections, setCollections] = useState<Collection[]>([])
  const [view, setView] = useState<'favorites' | 'collections' | 'search'>('favorites')
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [shareUrl, setShareUrl] = useState(''), [collectionName, setCollectionName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    const [f, c] = await Promise.all([savedRequest<{ placeIds: string[] }>('/favorites'), savedRequest<{ collections: Collection[] }>('/collections')])
    setFavorites(f.placeIds); setCollections(c.collections)
  }, [])
  useEffect(() => { if (!user) return; void Promise.resolve().then(refresh).catch(e => setError(e.message)); const timer = window.setInterval(() => void refresh().catch(() => {}), 15000); return () => window.clearInterval(timer) }, [user, refresh])
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.') } finally { setBusy(false) } }
  const selectedCollection = collections.find(collection => collection._id === selectedCollectionId) ?? collections[0]
  if (loading) return <main id="main-content" className="saved-page">Loading…</main>
  if (!user) return <main id="main-content" className="saved-page"><h1>Saved for later</h1><p>Sign in to save restaurants and collections.</p><Link to={paths.login} state={{ from: '/saved' }}>Log in</Link><p>Looking for your dinner crew? <Link to={paths.groups}>Explore Groups</Link></p></main>
  return <main id="main-content" className="saved-page"><h1>Your saved restaurants</h1><p>Dinner crews and lobby invitations now have a home in <Link to={paths.groups}>Groups</Link>.</p>{error && <p role="alert">{error}</p>}
    <nav className="saved-page__tabs" aria-label="Saved sections">{([
      ['favorites', 'Favorites', favorites.length], ['collections', 'Collections', collections.length], ['search', 'Find restaurants', null],
    ] as const).map(([key, label, count]) => <button key={key} type="button" className={view === key ? 'is-active' : ''} aria-pressed={view === key} onClick={() => setView(key)}>{label}{count !== null && <span>{count}</span>}</button>)}</nav>
    {view === 'favorites' && <section><h2>Favorites</h2><PlaceList ids={favorites} remove={id => void run(() => savedRequest(`/favorites/${encodeURIComponent(id)}`, 'DELETE'))} /></section>}
    {view === 'collections' && <section className="saved-collection-section"><h2>Restaurant collections</h2>
      <div className="saved-collections">
        <aside className="saved-collections__sidebar" aria-label="Your collections">
          <h3>Your collections</h3>
          <form onSubmit={e => { e.preventDefault(); if (collectionName.trim()) void run(async () => { const result = await savedRequest<{ collection: Collection }>('/collections', 'POST', { name: collectionName.trim() }); setSelectedCollectionId(result.collection._id); setCollectionName(''); setShareUrl('') }) }}>
            <label>Collection name<input value={collectionName} onChange={e => setCollectionName(e.target.value)} maxLength={80} required /></label><button disabled={busy}>Create collection</button>
          </form>
          <nav aria-label="Choose a collection">{collections.length ? collections.map(c => <button type="button" key={c._id} className={c._id === selectedCollection?._id ? 'is-selected' : ''} aria-current={c._id === selectedCollection?._id ? 'page' : undefined} onClick={() => { setSelectedCollectionId(c._id); setShareUrl('') }}>{c.name}<small>{c.placeIds.length}</small></button>) : <p>No collections yet.</p>}</nav>
        </aside>
        <div className="saved-collections__detail">
          {selectedCollection ? <><h3>{selectedCollection.name}</h3><p>{selectedCollection.placeIds.length} saved restaurants</p>
            <RestaurantSearch key={selectedCollection._id} ids={selectedCollection.placeIds} favorites={favorites} onChanged={refresh} onRemove={id => void run(() => savedRequest(`/collections/${selectedCollection._id}/restaurants/${encodeURIComponent(id)}`, 'DELETE'))} />
            <div className="saved-collections__actions"><Link to={`${paths.createLobby}?collection=${encodeURIComponent(selectedCollection._id)}`}>Start a lobby with this collection</Link><button disabled={busy} onClick={() => void run(async () => { const share = await savedRequest<{ token: string }>(`/collections/${selectedCollection._id}/share`, 'POST'); setShareUrl(`${window.location.origin}/saved/import/${share.token}`) })}>Create share link</button><button disabled={busy} onClick={() => { if (window.confirm(`Delete ${selectedCollection.name}?`)) void run(() => savedRequest(`/collections/${selectedCollection._id}`, 'DELETE')) }}>Delete collection</button></div>
            {shareUrl && <p><label>Share link (expires after seven days)<input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} /></label> Copy this link to share it.</p>}
          </> : <p>Create a collection to start saving restaurants.</p>}
        </div>
      </div>
    </section>}
    {view === 'search' && <section><h2>Find restaurants</h2><p>Search restaurants already in the database and add them to your favorites.</p><RestaurantSearch favorites={favorites} collections={collections} onChanged={refresh} /></section>}
  </main>
}
