import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { savedRequest } from './savedApi'
import type { Collection } from './savedApi'
import { paths } from '../../routes/paths'
import './saved.css'

export function SaveRestaurant({ placeId }: { placeId: string }) {
  const { user } = useAuth()
  const [favorite, setFavorite] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([savedRequest<{ placeIds: string[] }>('/favorites'), savedRequest<{ collections: Collection[] }>('/collections')])
      .then(([f, c]) => { if (active) { setFavorite(f.placeIds.includes(placeId)); setCollections(c.collections); setSelected(c.collections[0]?._id ?? '') } })
      .catch(() => { if (active) setMessage('Could not load saved restaurants.') })
    return () => { active = false }
  }, [user, placeId])
  async function toggle() {
    setBusy(true); setMessage('')
    try { await savedRequest(`/favorites/${encodeURIComponent(placeId)}`, favorite ? 'DELETE' : 'PUT'); setFavorite(!favorite); setMessage(favorite ? 'Removed from favorites.' : 'Added to favorites.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save favorite.') } finally { setBusy(false) }
  }
  async function add() {
    if (!selected) return
    setBusy(true); setMessage('')
    try { await savedRequest(`/collections/${encodeURIComponent(selected)}/restaurants/${encodeURIComponent(placeId)}`, 'PUT'); setMessage('Added to collection.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save restaurant.') } finally { setBusy(false) }
  }
  if (!user) return <p><Link to={paths.login}>Log in</Link> to save restaurants.</p>
  return <div className="saved-control">
    <button type="button" disabled={busy} onClick={() => void toggle()} aria-pressed={favorite}>{favorite ? '♥ Favorited' : '♡ Add to favorites'}</button>
    {collections.length > 0 ? <><label>Collection <select value={selected} onChange={e => setSelected(e.target.value)}>{collections.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label><button type="button" disabled={busy} onClick={() => void add()}>Add to collection</button></> : <Link to="/saved">Create a collection</Link>}
    <span role="status">{message}</span>
  </div>
}
