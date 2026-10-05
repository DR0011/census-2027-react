import { useEffect, useMemo, useState } from 'react'
import './ContactOfficers.css'

const API_URL =
  'https://script.google.com/macros/s/AKfycbwefSeb0D7b2LyTBe72zUFZjyIVUlyvWNVTmjp4JQZVIoiPzqcCpaLCubbAcIIBIDvt/exec'

const SAMPLE_DATA = [
  {
    id: 'OFF-001',
    officerName: 'Rajesh Patel',
    designation: 'District Census Officer',
    officeDesignation: 'Deputy Director, Census Operations',
    phone: '9876543210',
    whatsapp: '9876543210',
    email: 'rajesh@example.com',
    officeEmail: 'dco@example.gov.in',
  },
  {
    id: 'OFF-002',
    officerName: 'Amit Shah',
    designation: 'Deputy Director',
    officeDesignation: 'Office of Census Operations',
    phone: '9876500000',
    whatsapp: '9876500000',
    email: 'amit@example.com',
    officeEmail: 'amit.office@example.gov.in',
  },
  {
    id: 'OFF-003',
    officerName: 'Kiran Patel',
    designation: 'Assistant Census Officer',
    officeDesignation: 'District Census Office',
    phone: '9876511111',
    whatsapp: '9876511111',
    email: 'kiran@example.com',
    officeEmail: 'kiran.office@example.gov.in',
  },
  {
    id: 'OFF-004',
    officerName: 'Mehul Shah',
    designation: 'Census Officer',
    officeDesignation: 'Office of District Census Officer',
    phone: '9876522222',
    whatsapp: '9876522222',
    email: 'mehul@example.com',
    officeEmail: 'mehul.office@example.gov.in',
  },
]

function getValue(obj, names) {
  for (const name of names) {
    if (obj[name] !== undefined && obj[name] !== null && String(obj[name]).trim() !== '') {
      return String(obj[name]).trim()
    }
  }
  return ''
}

function getUniqueId(officer, index) {
  const id = getValue(officer, ['id', 'ID', 'uniqueId', 'Unique ID', 'uniqueID', 'officerId', 'Officer ID'])
  if (id) return id
  return 'OFF-' + String(index + 1).padStart(3, '0')
}

function getInitial(name) {
  if (!name) return 'C'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function cleanPhone(phone) {
  return phone ? String(phone).replace(/[^\d+]/g, '') : ''
}

function cleanWhatsApp(number) {
  if (!number) return ''
  let value = String(number).replace(/\D/g, '')
  if (value.length === 10) value = '91' + value
  return value
}

const EMPTY_FORM = {
  officerName: '',
  designation: '',
  officeDesignation: '',
  phone: '',
  whatsapp: '',
  email: '',
  officeEmail: '',
}

function OfficerCard({ officer, index, isAuthority, onUpdate }) {
  const uniqueId = getUniqueId(officer, index)
  const name = getValue(officer, ['officerName', 'Officer Name', 'name', 'Name'])
  const designation = getValue(officer, ['designation', 'Designation'])
  const officeDesignation = getValue(officer, ['officeDesignation', 'Office Designation', 'office_designation'])
  const phone = getValue(officer, ['phone', 'Phone', 'phoneNumber', 'Phone Number'])
  const whatsapp = getValue(officer, ['whatsapp', 'WhatsApp', 'whatsappNumber', 'WhatsApp Number'])
  const email = getValue(officer, ['email', 'Email', 'emailAddress', 'Email Address'])
  const officeEmail = getValue(officer, ['officeEmail', 'Office Email', 'office_email'])

  const phoneNumber = cleanPhone(phone)
  const whatsappNumber = cleanWhatsApp(whatsapp)

  return (
    <article className="contact-card">
      <div className="officer-top">
        <div className="officer-icon">{getInitial(name)}</div>
        <div className="officer-info">
          <div className="officer-name">{name || 'Officer'}</div>
          <div className="designation">{designation || 'Designation not available'}</div>
          {officeDesignation && <div className="office-designation">{officeDesignation}</div>}
        </div>
      </div>

      <div className="unique-id">
        <span>Unique ID</span>
        <strong>{uniqueId}</strong>
      </div>

      <div className="contact-row">
        <div className="contact-label">Phone</div>
        <div className="contact-value">
          {phoneNumber ? <a href={`tel:${phoneNumber}`}>{phone}</a> : 'Not available'}
        </div>
      </div>

      <div className="contact-row">
        <div className="contact-label">WhatsApp</div>
        <div className="contact-value">
          {whatsappNumber ? (
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
              {whatsapp}
            </a>
          ) : (
            'Not available'
          )}
        </div>
      </div>

      <div className="contact-row">
        <div className="contact-label">Email</div>
        <div className="contact-value">{email ? <a href={`mailto:${email}`}>{email}</a> : 'Not available'}</div>
      </div>

      <div className="contact-row">
        <div className="contact-label">Office Email</div>
        <div className="contact-value">
          {officeEmail ? <a href={`mailto:${officeEmail}`}>{officeEmail}</a> : 'Not available'}
        </div>
      </div>

      <div className="actions">
        {phoneNumber ? (
          <a className="action-btn" href={`tel:${phoneNumber}`}>
            📞 Call
          </a>
        ) : (
          <span />
        )}

        {whatsappNumber ? (
          <a className="action-btn" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
            💬 WhatsApp
          </a>
        ) : (
          <span />
        )}

        {email ? (
          <a className="action-btn" href={`mailto:${email}`}>
            ✉ Email
          </a>
        ) : (
          <span />
        )}

        {isAuthority && (
          <button className="action-btn update-btn" type="button" onClick={() => onUpdate(uniqueId)}>
            ✏ Update
          </button>
        )}
      </div>
    </article>
  )
}

function OfficerFormFields({ values, onChange }) {
  const fields = [
    { key: 'officerName', label: 'Officer Name *', required: true, full: false },
    { key: 'designation', label: 'Designation *', required: true, full: false },
    { key: 'officeDesignation', label: 'Office Designation', full: true },
    { key: 'phone', label: 'Phone' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'email', label: 'Personal Email', type: 'email' },
    { key: 'officeEmail', label: 'Office Email', type: 'email' },
  ]

  return (
    <div className="form-grid">
      {fields.map((field) => (
        <div className={`form-group${field.full ? ' full' : ''}`} key={field.key}>
          <label htmlFor={field.key}>{field.label}</label>
          <input
            id={field.key}
            type={field.type || 'text'}
            required={field.required}
            value={values[field.key]}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}

export default function ContactOfficers() {
  const [officers, setOfficers] = useState([])
  const [statusMessage, setStatusMessage] = useState('Loading officer data...')
  const [statusIcon, setStatusIcon] = useState('⏳')
  const [loadFailed, setLoadFailed] = useState(false)
  const [search, setSearch] = useState('')

  const [authorityToken, setAuthorityToken] = useState(() => sessionStorage.getItem('authorityToken') || '')

  const [showLogin, setShowLogin] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addError, setAddError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateId, setUpdateId] = useState('')
  const [updateForm, setUpdateForm] = useState(EMPTY_FORM)
  const [isUpdating, setIsUpdating] = useState(false)

  async function loadAPI() {
    setStatusMessage('Loading officer data...')
    setStatusIcon('⏳')
    setLoadFailed(false)

    try {
      const response = await fetch(API_URL + '?t=' + Date.now(), { method: 'GET', cache: 'no-store' })
      if (!response.ok) throw new Error('API HTTP error: ' + response.status)

      const result = await response.json()
      let data
      if (Array.isArray(result)) data = result
      else if (result && Array.isArray(result.data)) data = result.data
      else throw new Error('API data format is incorrect.')

      setOfficers(data)
    } catch (error) {
      console.error('API ERROR:', error)
      setOfficers(SAMPLE_DATA.map((item) => ({ ...item })))
      setLoadFailed(true)
      setStatusIcon('⚠️')
      setStatusMessage('Unable to load API data. Showing demo data.')
    }
  }

  useEffect(() => {
    loadAPI()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredOfficers = useMemo(() => {
    const keyword = search.toLowerCase().trim()
    if (!keyword) return officers
    return officers.filter((officer) => JSON.stringify(officer).toLowerCase().includes(keyword))
  }, [officers, search])

  function findOfficerById(id) {
    return officers.find((officer, index) => getUniqueId(officer, index) === String(id))
  }

  function findOfficerByEmailOrPhone(email, phone) {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedPhone = String(phone || '').trim()
    if (!normalizedEmail && !normalizedPhone) return null

    return officers.find((officer) => {
      const officerEmail = getValue(officer, ['email', 'Email', 'emailAddress', 'Email Address']).toLowerCase()
      const officerPhone = getValue(officer, ['phone', 'Phone', 'phoneNumber', 'Phone Number'])
      const emailMatches = normalizedEmail && officerEmail && officerEmail === normalizedEmail
      const phoneMatches = normalizedPhone && officerPhone && officerPhone === normalizedPhone
      return emailMatches || phoneMatches
    })
  }

  // ---------- Authority login ----------
  function openAuthorityLogin() {
    setLoginUsername('')
    setLoginPassword('')
    setLoginError('')
    setShowLogin(true)
  }

  async function submitAuthorityLogin() {
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('Please enter username and password.')
      return
    }

    setLoggingIn(true)
    setLoginError('')

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', username: loginUsername.trim(), password: loginPassword }),
      })
      const result = await response.json()

      if (!result.success) {
        setLoginError(result.message || 'Invalid username or password.')
        return
      }

      setAuthorityToken(result.token)
      sessionStorage.setItem('authorityToken', result.token)
      sessionStorage.setItem('authorityUsername', result.username || '')
      setShowLogin(false)
      alert('Authority login successful.')
    } catch (error) {
      console.error(error)
      setLoginError('Unable to connect to server.')
    } finally {
      setLoggingIn(false)
    }
  }

  function authorityLogout() {
    setAuthorityToken('')
    sessionStorage.removeItem('authorityToken')
    sessionStorage.removeItem('authorityUsername')
    alert('You have been logged out.')
  }

  // ---------- Add officer ----------
  function openAddModal() {
    if (!authorityToken) {
      alert('Please login as authority first.')
      return
    }
    setAddForm(EMPTY_FORM)
    setAddError('')
    setShowAddModal(true)
  }

  async function submitAddOfficer(event) {
    event.preventDefault()
    if (isCreating) return
    setAddError('')

    const newOfficer = {
      action: 'create',
      token: authorityToken,
      name: addForm.officerName.trim(),
      designation: addForm.designation.trim(),
      officeDesignation: addForm.officeDesignation.trim(),
      phone: addForm.phone.trim(),
      whatsapp: addForm.whatsapp.trim(),
      email: addForm.email.trim(),
      officeEmail: addForm.officeEmail.trim(),
    }

    if (!newOfficer.name || !newOfficer.designation) {
      setAddError('Officer name and designation are required.')
      return
    }

    const existing = findOfficerByEmailOrPhone(newOfficer.email, newOfficer.phone)
    if (existing) {
      setAddError('An officer with this email or phone number already exists.')
      return
    }

    try {
      setIsCreating(true)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(newOfficer),
      })
      if (!response.ok) throw new Error('Create HTTP error: ' + response.status)

      const result = await response.json()
      if (!result.success) {
        setAddError(result.message || 'Unable to add officer.')
        return
      }

      setShowAddModal(false)
      await loadAPI()
      alert('Officer added successfully.')
    } catch (error) {
      console.error('CREATE ERROR:', error)
      setAddError('Add failed. Please check your connection and try again.')
    } finally {
      setIsCreating(false)
    }
  }

  // ---------- Update officer ----------
  function openUpdateModal(id) {
    const officer = findOfficerById(id)
    if (!officer) {
      alert('Officer not found.')
      return
    }

    setUpdateId(id)
    setUpdateForm({
      officerName: getValue(officer, ['officerName', 'Officer Name', 'name', 'Name']),
      designation: getValue(officer, ['designation', 'Designation']),
      officeDesignation: getValue(officer, ['officeDesignation', 'Office Designation', 'office_designation']),
      phone: getValue(officer, ['phone', 'Phone', 'phoneNumber', 'Phone Number']),
      whatsapp: getValue(officer, ['whatsapp', 'WhatsApp', 'whatsappNumber', 'WhatsApp Number']),
      email: getValue(officer, ['email', 'Email', 'emailAddress', 'Email Address']),
      officeEmail: getValue(officer, ['officeEmail', 'Office Email', 'office_email']),
    })
    setShowUpdateModal(true)
  }

  async function submitUpdateOfficer(event) {
    event.preventDefault()
    if (isUpdating) return
    if (!updateId) {
      alert('Unique ID is missing.')
      return
    }

    const updatedData = {
      action: 'update',
      token: authorityToken,
      uniqueId: updateId,
      name: updateForm.officerName.trim(),
      designation: updateForm.designation.trim(),
      officeDesignation: updateForm.officeDesignation.trim(),
      phone: updateForm.phone.trim(),
      whatsapp: updateForm.whatsapp.trim(),
      email: updateForm.email.trim(),
      officeEmail: updateForm.officeEmail.trim(),
    }

    try {
      setIsUpdating(true)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(updatedData),
      })
      if (!response.ok) throw new Error('Update HTTP error: ' + response.status)

      const result = await response.json()
      if (!result.success) throw new Error(result.message || 'Update failed')

      setShowUpdateModal(false)
      await loadAPI()
      alert('Officer information updated successfully.\n\nUnique ID: ' + updateId)
    } catch (error) {
      console.error('UPDATE ERROR:', error)
      alert('Update failed.\n\nPlease check the Apps Script deployment and API permissions.')
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShowUpdateModal(false)
        setShowAddModal(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const isAuthority = Boolean(authorityToken)

  return (
    <div className={`contacts-page${isAuthority ? ' authority-logged-in' : ''}`}>
      <main className="page">
        <header className="page-header">
          <div className="header-content">
            {!isAuthority ? (
              <button type="button" className="authority-login-btn" onClick={openAuthorityLogin}>
                🔐 Authority Login
              </button>
            ) : (
              <button type="button" className="authority-logout-btn" onClick={authorityLogout}>
                Logout
              </button>
            )}

            <div className="brand">
              <div className="brand-icon">🏛️</div>
              <div>
                <h1>Census 2027</h1>
                <p>Contact List of Census Officers</p>
              </div>
            </div>

            <div className="total-badge">
              <strong>{filteredOfficers.length}</strong>
              <span>Officers</span>
            </div>
          </div>
        </header>

        <section className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              id="searchInput"
              type="text"
              placeholder="Search name, designation, ID, phone or email..."
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isAuthority && (
            <button type="button" className="add-officer-btn" onClick={openAddModal}>
              ＋ Add Officer
            </button>
          )}

          <button className="refresh-btn" type="button" onClick={loadAPI}>
            ↻ Refresh
          </button>
        </section>

        <section className="contact-grid">
          {filteredOfficers.length === 0 ? (
            <div className="status">
              <div className="status-icon">{statusIcon}</div>
              <strong>{loadFailed ? 'Unable to load API data' : 'No officer data found'}</strong>
              <p style={{ marginTop: 6 }}>{loadFailed ? statusMessage : 'Try another search.'}</p>
            </div>
          ) : (
            filteredOfficers.map((officer, index) => (
              <OfficerCard
                key={getUniqueId(officer, index)}
                officer={officer}
                index={index}
                isAuthority={isAuthority}
                onUpdate={openUpdateModal}
              />
            ))
          )}
        </section>
      </main>

      {/* ADD MODAL */}
      <div className={`modal${showAddModal ? ' show' : ''}`} aria-hidden={!showAddModal}>
        <div className="modal-card">
          <div className="modal-header">
            <div>
              <div className="modal-title">Add Officer</div>
              <div className="modal-subtitle">Create a new census officer record</div>
            </div>
            <button className="close-btn" type="button" onClick={() => setShowAddModal(false)} aria-label="Close">
              ×
            </button>
          </div>

          <form onSubmit={submitAddOfficer}>
            <div className="modal-body">
              <div className="form-error">{addError}</div>
              <OfficerFormFields values={addForm} onChange={(key, value) => setAddForm((f) => ({ ...f, [key]: value }))} />
              <p className="form-hint">An officer with the same phone or email already on file cannot be added twice.</p>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel-btn" type="button" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="modal-btn save-btn" type="submit" disabled={isCreating}>
                {isCreating ? 'Adding...' : '✓ Add Officer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* UPDATE MODAL */}
      <div className={`modal${showUpdateModal ? ' show' : ''}`} aria-hidden={!showUpdateModal}>
        <div className="modal-card">
          <div className="modal-header">
            <div>
              <div className="modal-title">Update Officer</div>
              <div className="modal-subtitle">Edit information for the selected unique ID</div>
            </div>
            <button className="close-btn" type="button" onClick={() => setShowUpdateModal(false)} aria-label="Close">
              ×
            </button>
          </div>

          <form onSubmit={submitUpdateOfficer}>
            <div className="modal-body">
              <div className="id-display">Unique ID: {updateId}</div>
              <OfficerFormFields
                values={updateForm}
                onChange={(key, value) => setUpdateForm((f) => ({ ...f, [key]: value }))}
              />
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel-btn" type="button" onClick={() => setShowUpdateModal(false)}>
                Cancel
              </button>
              <button className="modal-btn save-btn" type="submit" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : '✓ Save Update'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* AUTHORITY LOGIN MODAL */}
      {showLogin && (
        <div className="authority-modal">
          <div className="authority-modal-box">
            <button className="authority-close" onClick={() => setShowLogin(false)}>
              ×
            </button>

            <h2>Authority Login</h2>
            <p className="authority-subtitle">Only authorized personnel can update officer information.</p>

            <div className="authority-form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              />
            </div>

            <div className="authority-form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <div className="authority-error">{loginError}</div>

            <button className="authority-login-submit" onClick={submitAuthorityLogin} disabled={loggingIn}>
              {loggingIn ? 'Checking...' : 'Login'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
