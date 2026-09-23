import './Placeholder.css'

export default function Letters() {
  return (
    <div className="placeholder-page">
      <div className="inner">
        <h1>Letters</h1>
        <p className="subtitle">Correspondence &rsaquo; Letters</p>

        <div className="placeholder-note">
          This page is ready for your letters list. Wire it up the same way as the other pages: add an{' '}
          <code>API_URL</code> constant pointing to your Google Apps Script endpoint, fetch the data inside a{' '}
          <code>useEffect</code>, and render it in a table or card list — you can copy the pattern used in{' '}
          <code>Documents.jsx</code> or <code>Circulars.jsx</code> as a starting point.
        </div>
      </div>
    </div>
  )
}
