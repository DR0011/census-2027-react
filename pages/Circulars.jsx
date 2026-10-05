import { useEffect, useMemo, useRef, useState } from 'react'
import './Circulars.css'

const API_URL =
  'https://script.google.com/macros/s/AKfycbx0qBMOE4HW6aJVE_FEyOQygi1ubdKb5aVwCPVcMOWQun0RjnWN12x0HtoFzqUNtx06qw/exec'

const COLUMN_NAMES = {
  documentNo: 'Document No',
  referenceNo: 'Reference No',
  date: 'Date',
  description: 'Description',
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(value) {
  if (!value) return new Date(0)
  const parts = String(value).split('/')
  if (parts.length !== 3) return new Date(0)
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
}

function getFileId(url) {
  if (!url) return ''
  const text = String(url).trim()
  let match = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  match = text.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  return ''
}

function getPdfUrl(url) {
  if (!url) return ''
  const text = String(url).trim()
  const fileId = getFileId(text)
  if (fileId) return 'https://drive.google.com/file/d/' + fileId + '/view'
  if (text.startsWith('http://') || text.startsWith('https://')) return text
  return ''
}

function getDownloadUrl(url) {
  if (!url) return ''
  const text = String(url).trim()
  const fileId = getFileId(text)
  if (fileId) return 'https://drive.google.com/uc?export=download&id=' + fileId
  if (text.startsWith('http://') || text.startsWith('https://')) return text
  return ''
}

function getColumnValue(row, column) {
  switch (column) {
    case 'documentNo':
      return row.documentNo || ''
    case 'referenceNo':
      return row.referenceNo || ''
    case 'date':
      return row.date || ''
    case 'description':
      return [row.descriptionEn || '', row.descriptionHi || ''].filter(Boolean).join(' | ')
    default:
      return ''
  }
}

function PdfButtons({ url }) {
  const viewUrl = getPdfUrl(url)
  const downloadUrl = getDownloadUrl(url)

  if (!viewUrl) {
    return <span className="pdf-not-available">PDF not available</span>
  }

  return (
    <div className="description-pdf-buttons">
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="pdf-btn">
        View
      </a>
      <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="pdf-btn">
        Download
      </a>
    </div>
  )
}

export default function Circulars() {
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('all')

  const [sortColumn, setSortColumn] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')

  const [activeFilters, setActiveFilters] = useState({
    documentNo: new Set(),
    referenceNo: new Set(),
    date: new Set(),
    description: new Set(),
  })

  const [popup, setPopup] = useState(null) // { column, top, left }
  const [tempSelected, setTempSelected] = useState(new Set())
  const [popupSearch, setPopupSearch] = useState('')
  const popupRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        setLoading(true)
        setError('')
        const response = await fetch(API_URL)
        if (!response.ok) throw new Error('HTTP Error: ' + response.status)
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'API returned an error')
        if (!cancelled) {
          setAllData(Array.isArray(result.data) ? result.data : [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  // Close popup on outside click
  useEffect(() => {
    function handleClick(event) {
      if (!popup) return
      if (popupRef.current && !popupRef.current.contains(event.target) && !event.target.closest('.filter-button')) {
        setPopup(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [popup])

  function getUniqueValues(column) {
    const values = new Map()
    allData.forEach((row) => {
      const value = getColumnValue(row, column)
      if (!value) return
      if (column === 'description') {
        ;[row.descriptionEn, row.descriptionHi].forEach((desc) => {
          if (desc) {
            const key = normalizeText(desc)
            if (!values.has(key)) values.set(key, desc)
          }
        })
      } else {
        const key = normalizeText(value)
        if (!values.has(key)) values.set(key, value)
      }
    })

    return Array.from(values.values()).sort((a, b) => {
      if (column === 'date') return parseDate(b) - parseDate(a)
      return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
    })
  }

  const filteredData = useMemo(() => {
    const searchNorm = normalizeText(search)

    let result = allData.filter((row) => {
      if (searchNorm) {
        const searchable = normalizeText(
          [row.documentNo, row.referenceNo, row.date, row.descriptionEn, row.descriptionHi]
            .filter(Boolean)
            .join(' ')
        )
        if (!searchable.includes(searchNorm)) return false
      }

      if (activeFilters.documentNo.size && !activeFilters.documentNo.has(normalizeText(row.documentNo))) return false
      if (activeFilters.referenceNo.size && !activeFilters.referenceNo.has(normalizeText(row.referenceNo))) return false
      if (activeFilters.date.size && !activeFilters.date.has(normalizeText(row.date))) return false

      if (activeFilters.description.size) {
        const en = normalizeText(row.descriptionEn)
        const hi = normalizeText(row.descriptionHi)
        if (!activeFilters.description.has(en) && !activeFilters.description.has(hi)) return false
      }

      if (language === 'english' && !row.descriptionEn && !row.englishPdf) return false
      if (language === 'hindi' && !row.descriptionHi && !row.hindiPdf) return false

      return true
    })

    result = [...result].sort((a, b) => {
      let valueA
      let valueB

      if (sortColumn === 'date') {
        valueA = parseDate(a.date)
        valueB = parseDate(b.date)
      } else if (sortColumn === 'description') {
        valueA = normalizeText(a.descriptionEn || a.descriptionHi)
        valueB = normalizeText(b.descriptionEn || b.descriptionHi)
      } else {
        valueA = normalizeText(getColumnValue(a, sortColumn))
        valueB = normalizeText(getColumnValue(b, sortColumn))
      }

      let comparison
      if (valueA instanceof Date) {
        comparison = valueA - valueB
      } else {
        comparison = String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: 'base' })
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [allData, search, language, activeFilters, sortColumn, sortDirection])

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection(column === 'date' ? 'desc' : 'asc')
    }
  }

  function openFilter(column, event) {
    setTempSelected(new Set(activeFilters[column]))
    setPopupSearch('')

    let top = 0
    let left = 0
    if (window.innerWidth > 720 && event) {
      const rect = event.currentTarget.getBoundingClientRect()
      const popupWidth = 280
      left = rect.left
      top = rect.bottom + 5
      if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10
      if (top + 430 > window.innerHeight) top = rect.top - 435
      left = Math.max(10, left)
      top = Math.max(10, top)
    }

    setPopup({ column, top, left })
  }

  function closePopup() {
    setPopup(null)
  }

  function toggleTempValue(value) {
    const key = normalizeText(value)
    setTempSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAllTemp() {
    if (!popup) return
    const values = getUniqueValues(popup.column)
    setTempSelected((prev) => {
      const next = new Set(prev)
      values.forEach((v) => next.add(normalizeText(v)))
      return next
    })
  }

  function clearTemp() {
    setTempSelected(new Set())
  }

  function applyFilter() {
    if (!popup) return
    setActiveFilters((prev) => ({ ...prev, [popup.column]: new Set(tempSelected) }))
    closePopup()
  }

  function removeFilterValue(column, value) {
    setActiveFilters((prev) => {
      const next = { ...prev }
      const set = new Set(prev[column])
      set.delete(value)
      next[column] = set
      return next
    })
  }

  function clearAllFilters() {
    setActiveFilters({
      documentNo: new Set(),
      referenceNo: new Set(),
      date: new Set(),
      description: new Set(),
    })
    setSearch('')
    setLanguage('all')
  }

  const popupValues = useMemo(() => {
    if (!popup) return []
    let values = getUniqueValues(popup.column)
    const s = normalizeText(popupSearch)
    if (s) values = values.filter((v) => normalizeText(v).includes(s))
    return values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, popupSearch, allData])

  const activeFilterTags = []
  Object.keys(activeFilters).forEach((column) => {
    activeFilters[column].forEach((value) => {
      activeFilterTags.push({ column, value })
    })
  })

  return (
    <div className="circulars-page">
      <div className="container">
        <div className="filter-bar">
          <input
            className="search-box"
            type="text"
            placeholder="Search Document No, Reference No, Date or Description..."
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="language-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="all">All Languages</option>
            <option value="english">English</option>
            <option value="hindi">हिन्दी</option>
          </select>

          <button className="clear-all" type="button" onClick={clearAllFilters}>
            Clear All
          </button>
        </div>

        <div className="mobile-sort-bar">
          <select value={sortColumn} onChange={(e) => handleSort(e.target.value)}>
            <option value="date">Sort by: Date</option>
            <option value="documentNo">Sort by: Document No</option>
            <option value="referenceNo">Sort by: Reference No</option>
            <option value="description">Sort by: Description</option>
          </select>
          <button
            type="button"
            title="Toggle sort direction"
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDirection === 'asc' ? '▲' : '▼'}
          </button>
        </div>

        <div className="active-filters">
          {activeFilterTags.map(({ column, value }) => (
            <div className="filter-tag" key={column + value}>
              {COLUMN_NAMES[column]}: {value}
              <button title="Remove filter" onClick={() => removeFilterValue(column, value)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {(loading || error) && (
          <div className={`status${error ? ' error' : ''}`}>
            {loading ? 'Loading data...' : (
              <>
                Unable to load data.
                <br />
                <br />
                {error}
                <br />
                <br />
                Please check your Google Apps Script API.
              </>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>
                  <div className="header-content">
                    <span>Sr No</span>
                  </div>
                </th>
                {['documentNo', 'referenceNo', 'date', 'description'].map((col) => (
                  <th key={col} className="filter-button">
                    <div className="header-content">
                      <span className="header-title" onClick={() => handleSort(col)}>
                        {COLUMN_NAMES[col]}
                        <span className="sort-icon">{sortColumn === col ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                      </span>
                      <span style={{ cursor: 'pointer' }} onClick={(e) => openFilter(col, e)} title={`Filter ${COLUMN_NAMES[col]}`}>
                        ⏷
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="no-data">
                    No data found
                  </td>
                </tr>
              )}

              {filteredData.map((row, index) => {
                const showEn = row.descriptionEn && (language === 'all' || language === 'english')
                const showHi = row.descriptionHi && (language === 'all' || language === 'hindi')

                return (
                  <tr key={index}>
                    <td data-label="Sr No">{index + 1}</td>
                    <td data-label="Document No">{row.documentNo || ''}</td>
                    <td data-label="Reference No">{row.referenceNo || ''}</td>
                    <td data-label="Date">{row.date || ''}</td>
                    <td className="description" data-label="Description">
                      {!showEn && !showHi && <span style={{ color: '#999' }}>—</span>}
                      {showEn && (
                        <div className="description-language-block">
                          <div className="description-text">{row.descriptionEn}</div>
                          <PdfButtons url={row.englishPdf} />
                        </div>
                      )}
                      {showHi && (
                        <div className="description-language-block">
                          <div className="description-text">{row.descriptionHi}</div>
                          <PdfButtons url={row.hindiPdf} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="count">
          Showing {filteredData.length} of {allData.length} records
        </div>
      </div>

      {popup && (
        <div
          className="filter-popup active"
          ref={popupRef}
          style={
            window.innerWidth > 720
              ? { top: popup.top, left: popup.left }
              : {}
          }
        >
          <div className="popup-header">Filter {COLUMN_NAMES[popup.column]}</div>

          <input
            className="popup-search"
            type="text"
            placeholder="Search values..."
            value={popupSearch}
            onChange={(e) => setPopupSearch(e.target.value)}
          />

          <div className="popup-actions">
            <button className="popup-action" onClick={selectAllTemp}>
              Select All
            </button>
            <button className="popup-action" onClick={clearTemp}>
              Clear Filter
            </button>
          </div>

          <div className="selected-count">{tempSelected.size} selected</div>

          <div className="filter-options">
            {popupValues.length === 0 && <div className="no-options">No values found</div>}
            {popupValues.map((value) => (
              <label className="filter-option" key={value}>
                <input
                  type="checkbox"
                  checked={tempSelected.has(normalizeText(value))}
                  onChange={() => toggleTempValue(value)}
                />
                <span className="option-text">{value}</span>
              </label>
            ))}
          </div>

          <div className="popup-footer">
            <button className="apply-btn" onClick={applyFilter}>
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
