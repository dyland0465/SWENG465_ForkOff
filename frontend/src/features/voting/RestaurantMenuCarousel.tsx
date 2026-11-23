import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'

type MenuItem = { name: string; description: string; price: number | null }
type MenuHighlights = { items: MenuItem[]; sourceUrl?: string }
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function readHighlights(menu: unknown): MenuHighlights | null {
  if (!menu || typeof menu !== 'object' || !('categories' in menu) || !Array.isArray(menu.categories)) return null
  const items: MenuItem[] = []
  categories: for (const category of menu.categories) {
    if (!Array.isArray(category?.items)) continue
    for (const item of category.items) {
      if (typeof item?.name !== 'string' || !item.name.trim()) continue
      items.push({
        name: item.name.trim(),
        description: typeof item.description === 'string' ? item.description.trim() : '',
        price: typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 ? item.price : null,
      })
      if (items.length === 5) break categories
    }
  }
  if (!items.length) return null
  const sourceUrl = 'sourceUrl' in menu && typeof menu.sourceUrl === 'string' ? URL.parse(menu.sourceUrl) : null
  return { items, sourceUrl: sourceUrl?.protocol === 'https:' ? sourceUrl.href : undefined }
}

export function RestaurantMenuCarousel({ placeId, name, address }: { placeId: string; name: string; address: string | null }) {
  const [menu, setMenu] = useState<MenuHighlights | null>(null)
  const [checked, setChecked] = useState(false)
  const [position, setPosition] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const retryDelays = [4000, 8000, 3000]
    let retry: ReturnType<typeof setTimeout> | undefined

    async function loadMenu(attempt = 0) {
      try {
        const response = await fetch(`/api/restaurants/${encodeURIComponent(placeId)}/menu`, { signal: controller.signal, cache: 'no-store' })
        const highlights = response.ok ? readHighlights((await response.json()).menu) : null
        if (controller.signal.aborted) return
        setChecked(true)
        if (highlights) setMenu(highlights)
        else if (response.ok && attempt < retryDelays.length) retry = setTimeout(() => void loadMenu(attempt + 1), retryDelays[attempt])
      } catch { if (!controller.signal.aborted) setChecked(true) }
    }

    void loadMenu()
    return () => { controller.abort(); clearTimeout(retry) }
  }, [placeId])

  if (!menu) {
    if (!checked) return null
    const query = [name, address, 'menu'].filter(Boolean).join(' ')
    return <a className="voting-menu__source" href={`https://www.google.com/search?q=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">Search for a menu</a>
  }
  const { items, sourceUrl } = menu
  const item = items[position]
  const move = (offset: number) => setPosition(current => (current + offset + items.length) % items.length)

  return (
    <section className="voting-menu" aria-label="Menu highlights">
      <div className="voting-menu__header">
        <h3>Menu highlights</h3>
        {items.length > 1 && <div className="voting-menu__controls">
          <Button variant="secondary" onClick={() => move(-1)} aria-label="Previous menu item">Previous</Button>
          <Button variant="secondary" onClick={() => move(1)} aria-label="Next menu item">Next</Button>
        </div>}
      </div>
      <div className="voting-menu__item" aria-live="polite" aria-atomic="true">
        <div className="voting-menu__item-heading">
          <strong>{item.name}</strong>
          {item.price !== null && <span>{dollars.format(item.price)}</span>}
        </div>
        {item.description && <p>{item.description}</p>}
        {items.length > 1 && <small>{position + 1} of {items.length}</small>}
      </div>
      {sourceUrl && <a className="voting-menu__source" href={sourceUrl} target="_blank" rel="noreferrer">Full menu</a>}
    </section>
  )
}
