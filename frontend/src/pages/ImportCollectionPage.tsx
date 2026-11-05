import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { savedRequest } from '../features/saved/savedApi'
import { paths } from '../routes/paths'
import '../features/saved/saved.css'
export function ImportCollectionPage() {
  const { token = '' } = useParams(), { user, loading } = useAuth(), navigate = useNavigate()
  const [preview, setPreview] = useState<{ name: string; placeIds: string[] } | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (user && token) void savedRequest<{ name: string; placeIds: string[] }>(`/shares/${encodeURIComponent(token)}`).then(setPreview).catch(e => setError(e.message)) }, [user, token])
  async function importCollection() { setBusy(true); setError(''); try { await savedRequest(`/shares/${encodeURIComponent(token)}`, 'POST'); navigate(paths.saved) } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.') } finally { setBusy(false) } }
  return <main id="main-content" className="saved-page"><h1>Import a collection</h1>{loading ? <p>Loading…</p> : !user ? <p><Link to={paths.login} state={{ from: `/saved/import/${token}` }}>Log in</Link> to preview and import this collection.</p> : <>{error && <p role="alert">{error}</p>}{preview && <section><h2>{preview.name}</h2><p>{preview.placeIds.length} restaurants. Importing creates your own independent copy.</p><button type="button" disabled={busy} onClick={() => void importCollection()}>Import collection</button></section>}</>}</main>
}
