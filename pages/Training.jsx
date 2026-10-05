import './Placeholder.css'

export default function Training() {
  return (
    <div className="placeholder-page">
      <div className="inner">
        <h1>Training</h1>
        <p className="subtitle">Training material and schedules</p>

        <div className="placeholder-note">
          This page is ready for your training content (schedules, videos, PDFs, FAQs). Add an{' '}
          <code>API_URL</code> constant and fetch/render the data the same way the other pages do, or list
          static training resources directly in this component.
        </div>
      </div>
    </div>
  )
}
