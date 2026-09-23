import { useMemo, useState } from 'react'
import './AdminUnits.css'

// Set this to your Apps Script endpoint to load real data instead of the
// generated dummy hierarchy below.
const API_URL = ''

const GUJARAT_DISTRICTS = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad',
  'Chhota Udepur', 'Dahod', 'Dang', 'Devbhumi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar',
  'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara',
  'Valsad', 'Vav-Tharad',
]

const UT_DISTRICTS = ['Dadra & Nagar Haveli', 'Daman', 'Diu']

function createDummyData() {
  const data = { states: [], districts: [], subDistricts: [], villages: [], towns: [], wards: [] }

  data.states = [
    { id: 'GJ', code: 'GJ', name: 'Gujarat', type: 'State' },
    { id: 'DNHDD', code: 'DNHDD', name: 'Dadra & Nagar Haveli and Daman & Diu', type: 'UT' },
  ]

  let districtCounter = 1
  let subDistrictCounter = 1
  let villageCounter = 1
  let townCounter = 1
  let wardCounter = 1

  function buildDistricts(districtNames, parentId, subDistrictsPerDistrict, villagesPerSub, townsPerSub) {
    districtNames.forEach((districtName) => {
      const districtId = 'DT-' + String(districtCounter).padStart(3, '0')
      data.districts.push({ id: districtId, parentId, code: districtId, name: districtName, type: 'District' })
      districtCounter++

      for (let s = 1; s <= subDistrictsPerDistrict; s++) {
        const subDistrictId = 'SD-' + String(subDistrictCounter).padStart(3, '0')
        data.subDistricts.push({
          id: subDistrictId,
          parentId: districtId,
          code: subDistrictId,
          name: districtName + ' Sub-District ' + s,
          type: 'Sub-District',
        })
        subDistrictCounter++

        for (let v = 1; v <= villagesPerSub; v++) {
          const villageId = 'V' + String(villageCounter).padStart(3, '0')
          data.villages.push({
            id: villageId,
            parentId: subDistrictId,
            code: villageId,
            name: districtName + ' Village ' + s + '-' + v,
            type: 'Village',
          })
          villageCounter++
        }

        for (let t = 1; t <= townsPerSub; t++) {
          const townId = 'T' + String(townCounter).padStart(3, '0')
          data.towns.push({
            id: townId,
            parentId: subDistrictId,
            code: townId,
            name: districtName + ' Town ' + s + '-' + t,
            type: 'Town',
          })

          for (let w = 1; w <= 2; w++) {
            const wardId = 'W' + String(wardCounter).padStart(3, '0')
            data.wards.push({
              id: wardId,
              parentId: townId,
              code: wardId,
              name: 'Ward ' + w + ' - ' + districtName + ' Town ' + t,
              type: 'Ward',
            })
            wardCounter++
          }

          townCounter++
        }
      }
    })
  }

  buildDistricts(GUJARAT_DISTRICTS, 'GJ', 3, 3, 2)
  buildDistricts(UT_DISTRICTS, 'DNHDD', 2, 2, 2)

  return data
}

const ROOT_PATH = [{ level: 'states', id: null, name: 'State / UT' }]

export default function AdminUnits() {
  const [adminData] = useState(() => createDummyData())

  const [navigationPath, setNavigationPath] = useState(ROOT_PATH)
  const [currentLevel, setCurrentLevel] = useState('states')
  const [currentParentId, setCurrentParentId] = useState(null)
  const [currentTitle, setCurrentTitle] = useState('State / UT')
  const [currentDescription, setCurrentDescription] = useState('Select a State / UT to continue.')

  const [selectedVillage, setSelectedVillage] = useState(null)
  const [selectedWard, setSelectedWard] = useState(null)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  function getData(level, parentId = null) {
    if (level === 'states') return adminData.states
    if (level === 'districts') return adminData.districts.filter((i) => String(i.parentId) === String(parentId))
    if (level === 'subDistricts') return adminData.subDistricts.filter((i) => String(i.parentId) === String(parentId))
    if (level === 'villages') {
      const villages = adminData.villages.filter((i) => String(i.parentId) === String(parentId))
      const towns = adminData.towns.filter((i) => String(i.parentId) === String(parentId))
      return [...villages, ...towns]
    }
    if (level === 'wards') return adminData.wards.filter((i) => String(i.parentId) === String(parentId))
    return []
  }

  function findById(id) {
    if (!id) return null
    const all = [
      ...adminData.states,
      ...adminData.districts,
      ...adminData.subDistricts,
      ...adminData.villages,
      ...adminData.towns,
      ...adminData.wards,
    ]
    return all.find((item) => String(item.id) === String(id)) || null
  }

  const currentData = useMemo(() => getData(currentLevel, currentParentId), [adminData, currentLevel, currentParentId])

  function navigate(level, parentId, parentName, title, description) {
    setCurrentLevel(level)
    setCurrentParentId(parentId)
    setCurrentTitle(title)
    setCurrentDescription(description)
    setSortKey(null)
    setSortDirection('asc')
    setSearch('')
    setNavigationPath((prev) => [...prev, { level, id: parentId, name: parentName }])
  }

  function openItem(item) {
    if (item.type === 'State' || item.type === 'UT') {
      setSelectedVillage(null)
      setSelectedWard(null)
      navigate('districts', item.id, item.name, 'District', 'Select a District.')
      return
    }
    if (item.type === 'District') {
      setSelectedVillage(null)
      setSelectedWard(null)
      navigate('subDistricts', item.id, item.name, 'Sub-District', 'Select a Sub-District.')
      return
    }
    if (item.type === 'Sub-District') {
      setSelectedVillage(null)
      setSelectedWard(null)
      navigate('villages', item.id, item.name, 'Village & Town', 'Select a Village or Town.')
      return
    }
    if (item.type === 'Village') {
      setSelectedVillage(item)
      setSelectedWard(null)
      return
    }
    if (item.type === 'Town') {
      setSelectedVillage(null)
      setSelectedWard(null)
      navigate('wards', item.id, item.name, 'Ward', 'Select a Ward.')
      return
    }
    if (item.type === 'Ward') {
      setSelectedWard(item)
      return
    }
  }

  function goToStep(index) {
    const step = navigationPath[index]
    setNavigationPath(navigationPath.slice(0, index + 1))
    setCurrentLevel(step.level)
    setCurrentParentId(step.id)
    setSelectedVillage(null)
    setSelectedWard(null)
    setSearch('')
    setSortKey(null)
    setSortDirection('asc')

    if (step.level === 'states') {
      setCurrentTitle('State / UT')
      setCurrentDescription('Select a State / UT to continue.')
    } else if (step.level === 'districts') {
      setCurrentTitle('District')
      setCurrentDescription('Select a District.')
    } else if (step.level === 'subDistricts') {
      setCurrentTitle('Sub-District')
      setCurrentDescription('Select a Sub-District.')
    } else if (step.level === 'villages') {
      setCurrentTitle('Village & Town')
      setCurrentDescription('Select a Village or Town.')
    } else if (step.level === 'wards') {
      setCurrentTitle('Ward')
      setCurrentDescription('Select a Ward.')
    }
  }

  function goBack() {
    if (navigationPath.length <= 1) return
    goToStep(navigationPath.length - 2)
  }

  // ---------- counts ----------
  function countSubDistrictsForState(stateId) {
    const districtIds = new Set(adminData.districts.filter((d) => String(d.parentId) === String(stateId)).map((d) => d.id))
    return adminData.subDistricts.filter((s) => districtIds.has(s.parentId)).length
  }

  function countVillagesForState(stateId) {
    const districtIds = new Set(adminData.districts.filter((d) => String(d.parentId) === String(stateId)).map((d) => d.id))
    const subDistrictIds = new Set(adminData.subDistricts.filter((s) => districtIds.has(s.parentId)).map((s) => s.id))
    return adminData.villages.filter((v) => subDistrictIds.has(v.parentId)).length
  }

  function countTownsForState(stateId) {
    const districtIds = new Set(adminData.districts.filter((d) => String(d.parentId) === String(stateId)).map((d) => d.id))
    const subDistrictIds = new Set(adminData.subDistricts.filter((s) => districtIds.has(s.parentId)).map((s) => s.id))
    return adminData.towns.filter((t) => subDistrictIds.has(t.parentId)).length
  }

  function countWardsForState(stateId) {
    const districtIds = new Set(adminData.districts.filter((d) => String(d.parentId) === String(stateId)).map((d) => d.id))
    const subDistrictIds = new Set(adminData.subDistricts.filter((s) => districtIds.has(s.parentId)).map((s) => s.id))
    const townIds = new Set(adminData.towns.filter((t) => subDistrictIds.has(t.parentId)).map((t) => t.id))
    return adminData.wards.filter((w) => townIds.has(w.parentId)).length
  }

  function countVillages(parentId) {
    if (!parentId) return 0
    return adminData.villages.filter((v) => String(v.parentId) === String(parentId)).length
  }

  function countTowns(parentId) {
    if (!parentId) return 0
    return adminData.towns.filter((t) => String(t.parentId) === String(parentId)).length
  }

  function countWardsForSubDistrict(subDistrictId) {
    if (!subDistrictId) return 0
    const townIds = adminData.towns.filter((t) => String(t.parentId) === String(subDistrictId)).map((t) => t.id)
    return adminData.wards.filter((w) => townIds.includes(w.parentId)).length
  }

  function countVillagesForDistrict(districtId) {
    const subDistrictIds = adminData.subDistricts.filter((s) => String(s.parentId) === String(districtId)).map((s) => s.id)
    return adminData.villages.filter((v) => subDistrictIds.includes(v.parentId)).length
  }

  function countTownsForDistrict(districtId) {
    const subDistrictIds = adminData.subDistricts.filter((s) => String(s.parentId) === String(districtId)).map((s) => s.id)
    return adminData.towns.filter((t) => subDistrictIds.includes(t.parentId)).length
  }

  function countWardsForDistrict(districtId) {
    const subDistrictIds = adminData.subDistricts.filter((s) => String(s.parentId) === String(districtId)).map((s) => s.id)
    const townIds = adminData.towns.filter((t) => subDistrictIds.includes(t.parentId)).map((t) => t.id)
    return adminData.wards.filter((w) => townIds.includes(w.parentId)).length
  }

  function getChildCount(item) {
    if (item.type === 'State' || item.type === 'UT') {
      return adminData.districts.filter((d) => String(d.parentId) === String(item.id)).length
    }
    if (item.type === 'District') {
      return adminData.subDistricts.filter((s) => String(s.parentId) === String(item.id)).length
    }
    if (item.type === 'Sub-District') {
      return (
        adminData.villages.filter((v) => String(v.parentId) === String(item.id)).length +
        adminData.towns.filter((t) => String(t.parentId) === String(item.id)).length
      )
    }
    if (item.type === 'Town') {
      return adminData.wards.filter((w) => String(w.parentId) === String(item.id)).length
    }
    return 0
  }

  // ---------- summary ----------
  const summaryItems = useMemo(() => {
    const items = []
    const add = (label, value) => items.push({ label, value })

    if (currentLevel === 'states') {
      add('State / UT', adminData.states.length)
      add('District', adminData.districts.length)
      add('Sub-District', adminData.subDistricts.length)
      add('Village', adminData.villages.length)
      add('Town', adminData.towns.length)
      add('Ward', adminData.wards.length)
    } else if (currentLevel === 'districts') {
      const state = findById(currentParentId)
      add('State / UT', state ? state.name : '-')
      add('District', currentData.length)
      add('Sub-District', countSubDistrictsForState(currentParentId))
      add('Village', countVillagesForState(currentParentId))
      add('Town', countTownsForState(currentParentId))
      add('Ward', countWardsForState(currentParentId))
    } else if (currentLevel === 'subDistricts') {
      const district = findById(currentParentId)
      const state = district ? findById(district.parentId) : null
      add('State / UT', state ? state.name : '-')
      add('District', district ? district.name : '-')
      add('Sub-District', currentData.length)
      add('Village', countVillagesForDistrict(currentParentId))
      add('Town', countTownsForDistrict(currentParentId))
      add('Ward', countWardsForDistrict(currentParentId))
    } else if (currentLevel === 'villages') {
      const subDistrict = findById(currentParentId)
      const district = subDistrict ? findById(subDistrict.parentId) : null
      const state = district ? findById(district.parentId) : null
      add('State / UT', state ? state.name : '-')
      add('District', district ? district.name : '-')
      add('Sub-District', subDistrict ? subDistrict.name : '-')
      add('Village', selectedVillage ? selectedVillage.name : countVillages(currentParentId))
      add('Town', countTowns(currentParentId))
      add('Ward', countWardsForSubDistrict(currentParentId))
    } else if (currentLevel === 'wards') {
      const town = findById(currentParentId)
      const subDistrict = town ? findById(town.parentId) : null
      const district = subDistrict ? findById(subDistrict.parentId) : null
      const state = district ? findById(district.parentId) : null
      add('State / UT', state ? state.name : '-')
      add('District', district ? district.name : '-')
      add('Sub-District', subDistrict ? subDistrict.name : '-')
      add('Village', subDistrict ? countVillages(subDistrict.id) : 0)
      add('Town', town ? town.name : '-')
      add('Ward', selectedWard ? selectedWard.name : currentData.length)
    }

    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminData, currentLevel, currentParentId, currentData, selectedVillage, selectedWard])

  // ---------- filtering + sorting ----------
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return currentData
    return currentData.filter((item) =>
      [item.name, item.code, item.type].some((value) => String(value ?? '').toLowerCase().includes(query))
    )
  }, [currentData, search])

  const sortedData = useMemo(() => {
    const result = [...filteredData]
    if (!sortKey) return result

    result.sort((a, b) => {
      let comparison = 0
      if (sortKey === 'count') {
        comparison = getChildCount(a) - getChildCount(b)
      } else {
        comparison = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      }
      if (comparison === 0) {
        comparison = String(a.code ?? '').localeCompare(String(b.code ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, sortKey, sortDirection])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  function sortIcon(key) {
    if (sortKey !== key) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const selectedRowId = selectedVillage?.id || selectedWard?.id || null

  return (
    <div className="admin-page">
      <div className="app">
        <div className="header">
          <h1>DCO Gujarat - Census 2027 Administrative Units</h1>
          <p>Gujarat Administrative Hierarchy</p>
        </div>

        <div className="breadcrumb">
          {navigationPath.map((item, index) => (
            <span key={index}>
              <button
                type="button"
                className={`breadcrumb-item${index === navigationPath.length - 1 ? ' current' : ''}`}
                onClick={() => index !== navigationPath.length - 1 && goToStep(index)}
              >
                {item.name}
              </button>
              {index < navigationPath.length - 1 && <span className="breadcrumb-separator"> › </span>}
            </span>
          ))}
        </div>

        <div className="summary-grid">
          {summaryItems.map((item) => (
            <div className="summary-card" key={item.label}>
              <div className="summary-label">{item.label}</div>
              <div className="summary-value">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="content-card">
          <div className="content-header">
            <h2>{currentTitle}</h2>
            <p>{currentDescription}</p>
          </div>

          <div className="toolbar table-toolbar">
            <button className="back-btn" onClick={goBack} disabled={navigationPath.length <= 1}>
              ← Back
            </button>

            <div className="search-box">
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Sr. No.</th>
                  <th style={{ width: 130 }}>
                    <button className={`sort-btn${sortKey === 'code' ? ' active' : ''}`} onClick={() => handleSort('code')}>
                      Code <span className="sort-icon">{sortIcon('code')}</span>
                    </button>
                  </th>
                  <th>
                    <button className={`sort-btn${sortKey === 'name' ? ' active' : ''}`} onClick={() => handleSort('name')}>
                      Name <span className="sort-icon">{sortIcon('name')}</span>
                    </button>
                  </th>
                  <th style={{ width: 150 }}>
                    <button className={`sort-btn${sortKey === 'type' ? ' active' : ''}`} onClick={() => handleSort('type')}>
                      Type <span className="sort-icon">{sortIcon('type')}</span>
                    </button>
                  </th>
                  <th style={{ width: 100 }}>
                    <button className={`sort-btn${sortKey === 'count' ? ' active' : ''}`} onClick={() => handleSort('count')}>
                      Count <span className="sort-icon">{sortIcon('count')}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="message">
                      No data found.
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item, index) => (
                    <tr key={item.id} className={item.id === selectedRowId ? 'selected-row' : ''}>
                      <td>{index + 1}</td>
                      <td className="code">{item.code}</td>
                      <td>
                        <button className="name-btn" type="button" onClick={() => openItem(item)}>
                          {item.name}
                        </button>
                      </td>
                      <td>
                        <span className="type-badge">{item.type}</span>
                      </td>
                      <td>{getChildCount(item)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mobile-list" />
        </div>

        <div className="footer">Census 2027 - DCO Gujarat{API_URL ? '' : ' (demo data)'}</div>
      </div>
    </div>
  )
}
