import './GoogleMapsLink.css'

export function GoogleMapsLink({ href }: { href: string }) {
  return <a className="google-maps-link" href={href} target="_blank" rel="noopener noreferrer" aria-label="View on Google Maps" title="View on Google Maps">
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 13.91A6 6 0 0 1 6.08 12c0-.66.11-1.3.32-1.91V7.5H3.06a10 10 0 0 0 0 9z" />
      <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.86-2.86A9.58 9.58 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.59C7.19 7.73 9.4 5.97 12 5.97z" />
    </svg>
  </a>
}
