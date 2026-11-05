import { useEffect, useState } from 'react'
import { cuisineOptions, priceOptions } from '../preferences/restaurantPreferences'
import { savedRequest } from './savedApi'
import type { Collection } from './savedApi'

type Result = { placeId: string; name: string | null; address: string | null; googleMapsUri: string | null }
type Response = { restaurants: Result[]; total: number; pageSize: number }

export function RestaurantSearch({ favorites, onChanged, ids, onRemove, collections = [] }: { favorites: string[]; onChanged: () => Promise<void>; ids?: string[]; onRemove?: (id: string) => void; collections?: Collection[] }) {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [collectionId, setCollectionId] = useState('')
  const [message, setMessage] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const selectedCollection = collections.find(collection => collection._id === collectionId) ?? collections[0]
  const idKey = ids?.join(',')
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ q: query, page: String(page) })
    if (idKey !== undefined) params.set('ids', idKey)
    if (category) params.set('category', category)
    if (price) params.set('price', price)
    setLoading(true); setError('')
    fetch(`/api/restaurants/search?${params}`, { signal: controller.signal }).then(async response => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not search restaurants.')
      return result as Response
    }).then(setData).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not search restaurants.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, page, idKey, category, price])
  async function toggle(id: string) {
    setBusy(id); setError('')
    try { await savedRequest(`/favorites/${encodeURIComponent(id)}`, favorites.includes(id) ? 'DELETE' : 'PUT'); await onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update favorite.') }
    finally { setBusy(null) }
  }
  async function addToCollection(id: string) {
    if (!selectedCollection) return
    setBusy(id); setError(''); setMessage('')
    try { await savedRequest(`/collections/${encodeURIComponent(selectedCollection._id)}/restaurants/${encodeURIComponent(id)}`, 'PUT'); await onChanged(); setMessage(`Added to ${selectedCollection.name}.`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add restaurant.') }
    finally { setBusy(null) }
  }
  function toggleSelected(id: string) {
    setSelectedIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  async function saveSelected(target: 'favorites' | 'collection') {
    if (!selectedIds.size || (target === 'collection' && !selectedCollection)) return
    const chosen = [...selectedIds]
    const todo = chosen.filter(id => target === 'favorites' ? !favorites.includes(id) : !selectedCollection!.placeIds.includes(id))
    setBusy('bulk'); setError(''); setMessage('')
    try {
      const failed: string[] = []
      for (let index = 0; index < todo.length; index += 5) {
        const batch = todo.slice(index, index + 5)
        const results = await Promise.allSettled(batch.map(id => savedRequest(target === 'favorites' ? `/favorites/${encodeURIComponent(id)}` : `/collections/${encodeURIComponent(selectedCollection!._id)}/restaurants/${encodeURIComponent(id)}`, 'PUT')))
        failed.push(...batch.filter((_, item) => results[item].status === 'rejected'))
      }
      setSelectedIds(new Set(failed))
      await onChanged()
      if (failed.length) setError(`${failed.length} could not be saved. They remain selected so you can retry.`)
      const updated = todo.length - failed.length
      setMessage(`${updated} ${updated === 1 ? 'restaurant' : 'restaurants'} added to ${target === 'favorites' ? 'favorites' : selectedCollection!.name}.${chosen.length > todo.length ? ' Already saved restaurants were skipped.' : ''}`)
    } catch { setError('Could not refresh saved items. Please try again.') }
    finally { setBusy(null) }
  }
  return <div className="saved-search">
    <form onSubmit={event => { event.preventDefault(); setPage(1); setQuery(draft.trim()) }}>
      <label>{ids ? 'Filter this collection' : 'Search by restaurant name or location'}<input type="search" maxLength={120} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Restaurant or location" /></label>
      <label>Cuisine<select value={category} onChange={event => { setPage(1); setCategory(event.target.value) }}><option value="">Any cuisine</option>{cuisineOptions.map(value => <option key={value} value={value.toLowerCase()}>{value}</option>)}</select></label>
      <label>Price<select value={price} onChange={event => { setPage(1); setPrice(event.target.value) }}><option value="">Any price</option>{priceOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button type="submit">Search</button>
    </form>
    {collections.length > 0 && <label className="saved-search__collection">Add results to<select value={selectedCollection?._id ?? ''} onChange={event => setCollectionId(event.target.value)}>{collections.map(collection => <option key={collection._id} value={collection._id}>{collection.name}</option>)}</select></label>}
    <div className="saved-search__bulk" role="group" aria-label="Actions for selected restaurants">
      <span>{selectedIds.size} selected</span>
      <button type="button" disabled={!selectedIds.size || busy !== null} onClick={() => void saveSelected('favorites')}>Favorite selected</button>
      {selectedCollection && <button type="button" disabled={!selectedIds.size || busy !== null} onClick={() => void saveSelected('collection')}>Add selected to collection</button>}
      {selectedIds.size > 0 && <button type="button" disabled={busy !== null} onClick={() => setSelectedIds(new Set())}>Clear selection</button>}
    </div>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Searching restaurants…</p> : data && <>
      <p role="status">{data.total} {data.total === 1 ? 'restaurant' : 'restaurants'} found</p>
      {data.restaurants.length > 0 && <label className="saved-search__select-page"><input type="checkbox" checked={data.restaurants.every(restaurant => selectedIds.has(restaurant.placeId))} onChange={event => { const checked = event.target.checked; setSelectedIds(current => { const next = new Set(current); data.restaurants.forEach(restaurant => { if (checked) next.add(restaurant.placeId); else next.delete(restaurant.placeId) }); return next }) }} /> Select all on this page</label>}
      {data.restaurants.length > 0 ? <ul>{data.restaurants.map(restaurant => <li key={restaurant.placeId}>
        <label className="saved-search__check"><input type="checkbox" checked={selectedIds.has(restaurant.placeId)} onChange={() => toggleSelected(restaurant.placeId)} aria-label={`Select ${restaurant.name ?? `restaurant ${restaurant.placeId}`}`} /></label>
        <div><strong>{restaurant.name ?? 'Restaurant name unavailable'}</strong><p>{restaurant.address ?? (!restaurant.name ? `Place ID: ${restaurant.placeId}` : '')}</p></div>
        {restaurant.googleMapsUri && <a href={restaurant.googleMapsUri} target="_blank" rel="noopener noreferrer">Google Maps</a>}
        {selectedCollection && <button type="button" disabled={busy !== null || selectedCollection.placeIds.includes(restaurant.placeId)} onClick={() => void addToCollection(restaurant.placeId)}>{selectedCollection.placeIds.includes(restaurant.placeId) ? 'In collection' : 'Add to collection'}</button>}
        {onRemove && <button type="button" onClick={() => onRemove(restaurant.placeId)}>Remove from collection</button>}
        <button type="button" disabled={busy !== null} aria-pressed={favorites.includes(restaurant.placeId)} onClick={() => void toggle(restaurant.placeId)}>{busy === restaurant.placeId ? 'Saving…' : favorites.includes(restaurant.placeId) ? '♥ Favorited' : '♡ Favorite'}</button>
      </li>)}</ul> : <p>No restaurants found. Try a different search.</p>}
      {data.total > data.pageSize && <div className="saved-search__pagination"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {Math.ceil(data.total / data.pageSize)}</span><button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Next</button></div>}
      <small>Restaurant information from Google Maps.</small>
    </>}
  </div>
}
