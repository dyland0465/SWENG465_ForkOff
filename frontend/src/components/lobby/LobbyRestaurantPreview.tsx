import { SaveRestaurant } from '../../features/saved/SaveRestaurant'
import { useEffect, useRef, useState } from 'react'
import { generatePath } from 'react-router'
import { TextAction } from '../ui/TextAction'
import { paths } from '../../routes/paths'

type PreviewRestaurant = {
  id: string
  name: string
  googleMapsUri?: string | null
  photoUrl?: string | null
  photoAuthors?: { displayName: string; uri?: string }[]
}

export function LobbyRestaurantPreview({ lobbyId, filterKey, isHost }: { lobbyId: string; filterKey: string; isHost: boolean }) {
  const [restaurants, setRestaurants] = useState<PreviewRestaurant[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [paused, setPaused] = useState(false)
  const strip = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<PreviewRestaurant | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (selected) dialog.current?.showModal()
  }, [selected])

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setRestaurants([])
    setPaused(false)
    fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/restaurants`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Search failed')
        const result = await response.json() as { restaurants: PreviewRestaurant[] }
        if (!Array.isArray(result.restaurants)) throw new Error('Invalid restaurant list')
        return result.restaurants
      })
      .then(places => { if (!controller.signal.aborted) { setRestaurants(places); setState('ready') } })
      .catch(() => { if (!controller.signal.aborted) setState('error') })
    return () => controller.abort()
  }, [lobbyId, filterKey, attempt])

  useEffect(() => {
    if (paused || restaurants.length <= 4 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let previous = 0
    const tick = (time: number) => {
      const element = strip.current
      if (element && previous) {
        const max = element.scrollWidth - element.clientWidth
        if (max > 0) {
          element.scrollLeft += (time - previous) * 0.025
          if (element.scrollLeft >= max - 1) element.scrollLeft = 0
        }
      }
      previous = time
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, restaurants])
  return (
    <section className="lobby-restaurant-preview" aria-label="Restaurant matches">
      {restaurants.length > 0 && <div className="lobby-restaurant-preview__carousel" role="region" aria-label="Matched restaurants">
        <div ref={strip} className="lobby-restaurant-preview__stack" onWheel={event => { setPaused(true); if (event.deltaY) event.currentTarget.scrollLeft += event.deltaY }} onPointerDown={() => setPaused(true)} onTouchStart={() => setPaused(true)} onKeyDown={() => setPaused(true)} tabIndex={0} aria-label="Scroll through restaurant previews">
          {restaurants.map(restaurant => <button type="button" key={restaurant.id} className="lobby-restaurant-preview__thumbnail" onClick={() => setSelected(restaurant)} aria-label={`View ${restaurant.name}`}>
            {restaurant.photoUrl ? <img src={restaurant.photoUrl} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden' }} /> : <span className="lobby-restaurant-preview__placeholder">No photo</span>}
            <span className="lobby-restaurant-preview__tooltip" aria-hidden="true">{restaurant.name}</span>
          </button>)}
        </div>
      </div>}
      <div className="lobby-restaurant-preview__content">
        {state === 'loading' && <p role="status">Finding restaurant matches…</p>}
        {state === 'error' && <p role="alert">Could not load restaurant matches. <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></p>}
        {state === 'ready' && <><strong>{restaurants.length} {restaurants.length === 1 ? 'restaurant' : 'restaurants'} matched</strong><p>{restaurants.length ? 'Ready for your group to vote on.' : 'Try changing your filters to find restaurants.'}</p></>}
        {state === 'ready' && <small className="lobby-restaurant-preview__attribution" translate="no">Google Maps</small>}
      </div>
      {isHost && <TextAction className="lobby-restaurant-preview__discovery" to={generatePath(paths.discoveryPreview, { lobbyId })}>Explore restaurants</TextAction>}
      {selected && <dialog ref={dialog} className="lobby-restaurant-preview__dialog" onClose={() => setSelected(null)}>
        <button type="button" onClick={() => dialog.current?.close()}>Close</button>
        <h2>{selected.name}</h2>
        <SaveRestaurant key={selected.id} placeId={selected.id} />
        {selected.photoUrl ? <img src={selected.photoUrl} alt={`Photo of ${selected.name}`} /> : <p>Photo unavailable</p>}
        {!!selected.photoAuthors?.length && <p>Photo: {selected.photoAuthors.map((author, index) => <span key={index}>{index > 0 && ', '}{author.uri ? <a href={author.uri} target="_blank" rel="noopener noreferrer">{author.displayName}</a> : author.displayName}</span>)}</p>}
        {selected.googleMapsUri && <a href={selected.googleMapsUri} target="_blank" rel="noopener noreferrer">View on Google Maps</a>}
      </dialog>}
    </section>
  )
}
