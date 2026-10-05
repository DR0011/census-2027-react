import { useEffect, useMemo, useState } from 'react'
import './Documents.css'

const API_URL =
  'https://script.google.com/macros/s/AKfycby75s4v7W1IFDyWN4RiT1j2JlfZ0tlhcsl2dshYmssdSXhyjmEDOA1zKe6gRFRyTkDvQA/exec'

function pick(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
      return item[key]
    }
  }
  return ''
}

function normalizeItem(item) {
  return {
    documentNo: pick(item, ['documentNo', 'docNo', 'Document No', 'Document No.', 'Doc No']),
    referenceNo: pick(item, ['referenceNo', 'refNo', 'Reference No', 'Reference No.', 'Ref No']),
    date: pick(item, ['date', 'Date']),
    description: pick(item, ['description', 'Description', 'subject', 'Subject', 'Circular Subject']),
    type: pick(item, ['type', 'Type']),
    pdf: pick(item, [
      'pdf',
      'PDF',
      'pdfUrl',
      'pdfURL',
      'PDF Link',
      'gujaratiPdf',
      'gujaratiPDF',
      'Gujarati PDF',
      'Gujarati Pdf',
    ]),
  }
}

function parseDate(value) {
  if (!value) return 0
  value = String(value).trim()

  let match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime()

  match = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime()

  match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()

  const parsed = Date.parse(value)
  return isNaN(parsed) ? 0 : parsed
}

function getGoogleDriveFileId(url) {
  if (!url) return ''
  url = String(url).trim()

  let match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return match[1]

  match = url.match(/[?&]id=([^&]+)/)
  if (match) return match[1]

  if (!url.includes('http://') && !url.includes('https://') && !url.includes('/')) return url

  return ''
}

function getViewUrl(url) {
  const fileId = getGoogleDriveFileId(url)
  return fileId ? `https://drive.google.com/file/d/${fileId}/view` : url
}

function getDownloadUrl(url) {
  const fileId = getGoogleDriveFileId(url)
  return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url
}

function PdfButtons({ url }) {
  if (!url) return <span className="no-pdf">Not Available</span>

  return (
    <div className="pdf-buttons">
      <a className="pdf-btn view-btn" href={getViewUrl(url)} target="_blank" rel="noopener noreferrer">
        View
      </a>
      <a className="pdf-btn download-btn" href={getDownloadUrl(url)} target="_blank" rel="noopener noreferrer">
        Download
      </a>
    </div>
  )
}

const SORTABLE_COLUMNS = {
  documentNo: 'Document No',
  referenceNo: 'Reference No',
  date: 'Date',
  description: 'Description',
  type: 'Type',
}

export default function Documents() {
  const [allData, setAllData] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        setStatus('loading')
        const response = await fetch(API_URL)
        if (!response.ok) throw new Error('API request failed')
        const data = await response.json()

        let items
        if (Array.isArray(data)) items = data
        else if (Array.isArray(data.data)) items = data.data
        else if (Array.isArray(data.documents)) items = data.documents
        else if (Array.isArray(data.result)) items = data.result
        else throw new Error('Invalid API data format')

        if (!cancelled) {
          setAllData(items.map(normalizeItem))
          setStatus('ready')
        }
      } catch (err) {
        console.error('API ERROR:', err)
        if (!cancelled) setStatus('error')
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection(column === 'date' ? 'desc' : 'asc')
    }
  }

  const filteredData = useMemo(() => {
    const term = search.toLowerCase().trim()

    let result = term
      ? allData.filter((item) =>
          [item.documentNo, item.referenceNo, item.date, item.description, item.type].some((value) =>
            String(value).toLowerCase().includes(term)
          )
        )
      : allData

    result = [...result].sort((a, b) => {
      let valueA = a[sortColumn] ?? ''
      let valueB = b[sortColumn] ?? ''

      if (sortColumn === 'date') {
        valueA = parseDate(valueA)
        valueB = parseDate(valueB)
      } else {
        valueA = String(valueA).toLowerCase().trim()
        valueB = String(valueB).toLowerCase().trim()
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [allData, search, sortColumn, sortDirection])

  return (
    <div className="documents-page">
      <div className="container">
        <div className="header">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search Document No, Reference No, Description, Type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="mobile-sort-bar">
            <select value={sortColumn} onChange={(e) => handleSort(e.target.value)}>
              {Object.entries(SORTABLE_COLUMNS).map(([key, label]) => (
                <option key={key} value={key}>
                  Sort by: {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="Toggle sort direction"
              onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            >
              {sortDirection === 'asc' ? '▲' : '▼'}
            </button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Sr No</th>
                {Object.entries(SORTABLE_COLUMNS).map(([key, label]) => (
                  <th key={key} data-sortable onClick={() => handleSort(key)}>
                    {label} {sortColumn === key ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </th>
                ))}
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && (
                <tr>
                  <td colSpan={7} className="loading">
                    Loading data...
                  </td>
                </tr>
              )}

              {status === 'error' && (
                <tr>
                  <td colSpan={7} className="error">
                    Unable to load API data.
                    <br />
                    Check your Apps Script API.
                  </td>
                </tr>
              )}

              {status === 'ready' && filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="no-data">
                    No data found
                  </td>
                </tr>
              )}

              {status === 'ready' &&
                filteredData.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td data-label="Document No">{item.documentNo}</td>
                    <td data-label="Reference No">{item.referenceNo}</td>
                    <td data-label="Date">{item.date}</td>
                    <td data-label="Description" className="description">
                      {item.description}
                    </td>
                    <td data-label="Type">{item.type}</td>
                    <td data-label="PDF">
                      <PdfButtons url={item.pdf} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
