import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { savedRequest } from './savedApi'
import type { Collection } from './savedApi'
import { paths } from '../../routes/paths'
import './saved.css'

export function SaveRestaurant({ placeId, compact = false }: { placeId: string; compact?: boolean }) {
  const { user } = useAuth()
  const [favorite, setFavorite] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [favoriteMessage, setFavoriteMessage] = useState('')
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
    const feedback = compact ? setFavoriteMessage : setMessage
    setBusy(true); feedback('')
    try {
      await savedRequest(`/favorites/${encodeURIComponent(placeId)}`, favorite ? 'DELETE' : 'PUT')
      setFavorite(!favorite)
      if (!compact) feedback(favorite ? 'Removed from favorites.' : 'Added to favorites.')
    }
    catch (error) { feedback(error instanceof Error ? error.message : 'Could not save favorite.') } finally { setBusy(false) }
  }
  async function add() {
    if (!selected) return
    setBusy(true); setMessage('')
    try { await savedRequest(`/collections/${encodeURIComponent(selected)}/restaurants/${encodeURIComponent(placeId)}`, 'PUT'); setMessage('Added to collection.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save restaurant.') } finally { setBusy(false) }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get('name') ?? '').trim()
    if (!name || busy) return
    setBusy(true)
    setMessage('')
    try {
      const { collection } = await savedRequest<{ collection: Collection }>('/collections', 'POST', { name })
      setCollections(current => [...current, collection])
      setSelected(collection._id)
      form.reset()
      setMessage('Collection created. Select Add to collection to save this restaurant.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create collection.')
    } finally {
      setBusy(false)
    }
  }
  const collectionPicker = <><label>Collection <select value={selected} onChange={e => setSelected(e.target.value)}>{collections.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label><button type="button" disabled={busy} onClick={() => void add()}>Add to collection</button></>
  if (compact) return <div className="saved-compact">
    <details className="saved-compact__collections">
      <summary className="saved-compact__icon" aria-label="Collections" title="Collections">📑</summary>
      <div className="saved-control saved-compact__menu">
        {user ? <>
          {collections.length > 0 && collectionPicker}
          <form onSubmit={event => void create(event)}>
            <label>New collection name <input name="name" maxLength={80} required /></label>
            <button type="submit" disabled={busy}>Create collection</button>
          </form>
          <p role="status">{message}</p>
        </> : <p><Link to={paths.login}>Log in</Link> to use collections.</p>}
      </div>
    </details>
    {user ? (
      <button className="saved-compact__icon" type="button" aria-label="Favorite" title={favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={favorite} disabled={busy} onClick={() => void toggle()}>
        {favorite ? '❤️' : '🤍'}
      </button>
    ) : <Link className="saved-compact__icon" to={paths.login} aria-label="Log in to add to favorites" title="Log in to add to favorites">🤍</Link>}
    <p className="saved-compact__feedback" role="status">{favoriteMessage}</p>
  </div>
  if (!user) return <p><Link to={paths.login}>Log in</Link> to save restaurants.</p>
  return <div className="saved-control">
    <button type="button" disabled={busy} onClick={() => void toggle()} aria-pressed={favorite}>{favorite ? '♥ Favorited' : '♡ Add to favorites'}</button>
    {collections.length > 0 ? collectionPicker : <Link to="/saved">Create a collection</Link>}
    <span role="status">{message}</span>
  </div>
}
