import './Placeholder.css'

export default function Download() {
  return (
    <div className="placeholder-page">
      <div className="inner">
        <h1>Download</h1>
        <p className="subtitle">Forms, formats and downloadable resources</p>

        <div className="placeholder-note">
          This page is ready for your downloadable files (forms, formats, guidelines). Add an{' '}
          <code>API_URL</code> constant and fetch/render the list the same way the other pages do, or list
          direct download links right in this component.
        </div>
      </div>
    </div>
  )
}
