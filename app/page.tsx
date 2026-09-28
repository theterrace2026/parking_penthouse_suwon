'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Car {
  id: number
  car_number: string
  owner?: string
  spot: string
  visit_date?: string
  created_at: string
  deletion_requested: boolean
}

interface DeletionRequest {
  id: number
  target_type: 'resident' | 'visitor'
  target_id: number
  car_number: string
  description?: string
  requested_at: string
}

type SortOrder = 'asc' | 'desc'

const thTdStyle: React.CSSProperties = {
  padding: '12px',
  border: '1px solid #ddd',
  textAlign: 'center'
}

export default function ParkingStatus() {
  const router = useRouter()
  const [residents, setResidents] = useState<Car[]>([])
  const [visitors, setVisitors] = useState<Car[]>([])
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [residentSort, setResidentSort] = useState<{ key: keyof Car; order: SortOrder }>(
    { key: 'owner', order: 'asc' }
  )
  const [visitorSort, setVisitorSort] = useState<{ key: keyof Car; order: SortOrder }>(
    { key: 'spot', order: 'asc' }
  )

  const fetchRequests = useCallback(async () => {
    const response = await fetch('/api/deletion-requests', { cache: 'no-store' })
    if (response.ok) {
      const data = await response.json()
      setRequests(data.requests || [])
    } else if (response.status === 401) {
      setIsAdmin(false)
      setRequests([])
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/parking-status', { cache: 'no-store' })
      const data = await response.json()
      setResidents(data.residents || [])
      setVisitors(data.visitors || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const auth = document.cookie.split(';').find(cookie => cookie.trim().startsWith('parking_auth='))
    if (!auth) router.push('/login')

    Promise.all([
      fetchData(),
      fetch('/api/admin/session')
        .then(response => response.json())
        .then(data => {
          setIsAdmin(Boolean(data.isAdmin))
          if (data.isAdmin) return fetchRequests()
        })
    ])
  }, [fetchData, fetchRequests, router])

  const requestDeletion = async (car: Car, type: 'resident' | 'visitor') => {
    const confirmMessage = type === 'visitor'
      ? `${car.car_number} 차량을 삭제하시겠습니까?`
      : `${car.car_number} 차량의 삭제를 요청하시겠습니까?`
    if (!confirm(confirmMessage)) return

    setBusy(true)
    try {
      const response = await fetch('/api/deletion-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: car.id, type })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      alert(type === 'visitor' ? '방문 차량을 삭제했습니다.' : '관리자에게 삭제 요청을 보냈습니다.')
      await fetchData()
      if (isAdmin) await fetchRequests()
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제 요청에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const enterAdminMode = async () => {
    const password = prompt('관리자 비밀번호를 입력하세요.')
    if (password === null) return

    const response = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    const data = await response.json()
    if (!response.ok) {
      alert(data.error || '관리자 인증에 실패했습니다.')
      return
    }
    setIsAdmin(true)
    await fetchRequests()
  }

  const exitAdminMode = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' })
    setIsAdmin(false)
    setRequests([])
  }

  const registerResident = async () => {
    const carNumber = prompt('차량번호를 입력하세요.')
    if (!carNumber) return
    const owner = prompt('호실을 입력하세요.')
    if (!owner) return
    const spot = prompt('비고를 입력하세요.', '') ?? ''

    setBusy(true)
    try {
      const response = await fetch('/api/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carNumber, owner, spot })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : '등록에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const editResident = async (car: Car) => {
    const carNumber = prompt('차량번호를 입력하세요.', car.car_number)
    if (!carNumber) return
    const owner = prompt('호실을 입력하세요.', car.owner ?? '')
    if (!owner) return
    const spot = prompt('비고를 입력하세요.', car.spot ?? '') ?? ''

    setBusy(true)
    try {
      const response = await fetch('/api/residents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: car.id, carNumber, owner, spot })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : '수정에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const deleteResident = async (car: Car) => {
    if (!confirm(`${car.car_number} 차량을 삭제하시겠습니까?`)) return

    setBusy(true)
    try {
      const response = await fetch(`/api/residents?id=${car.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const reviewRequest = async (requestId: number, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? '승인하여 차량을 삭제' : '반려'
    if (!confirm(`이 삭제 요청을 ${label}하시겠습니까?`)) return

    setBusy(true)
    try {
      const response = await fetch('/api/deletion-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await Promise.all([fetchData(), fetchRequests()])
    } catch (error) {
      alert(error instanceof Error ? error.message : '요청 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const sortData = <T,>(data: T[], key: keyof T, order: SortOrder) =>
    [...data].sort((a, b) => {
      const valA = a[key]
      const valB = b[key]
      if (!valA) return 1
      if (!valB) return -1

      const numA = Number(valA)
      const numB = Number(valB)
      if (!isNaN(numA) && !isNaN(numB)) return order === 'asc' ? numA - numB : numB - numA
      return order === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1)
    })

  const toggleSort = (
    current: { key: keyof Car; order: SortOrder },
    setter: React.Dispatch<React.SetStateAction<{ key: keyof Car; order: SortOrder }>>,
    key: keyof Car
  ) => {
    setter(current.key === key
      ? { key, order: current.order === 'asc' ? 'desc' : 'asc' }
      : { key, order: 'asc' })
  }

  const sortIcon = (current: { key: keyof Car; order: SortOrder }, key: keyof Car) => {
    if (current.key !== key) return '↕'
    return current.order === 'asc' ? '↑' : '↓'
  }

  const renderRequestButton = (car: Car, type: 'resident' | 'visitor') => (
    <button
      className="parking-delete-button"
      disabled={busy || car.deletion_requested}
      onClick={() => requestDeletion(car, type)}
      style={{
        padding: '6px 12px',
        fontSize: '14px',
        backgroundColor: car.deletion_requested ? '#6c757d' : '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: car.deletion_requested ? 'default' : 'pointer'
      }}
    >
      {car.deletion_requested ? '요청됨' : type === 'visitor' ? '삭제' : '삭제 요청'}
    </button>
  )

  const renderResidentActions = (car: Car) => isAdmin ? (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <button
        className="parking-delete-button"
        disabled={busy}
        onClick={() => editResident(car)}
        style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        수정
      </button>
      <button
        className="parking-delete-button"
        disabled={busy}
        onClick={() => deleteResident(car)}
        style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        삭제
      </button>
    </span>
  ) : renderRequestButton(car, 'resident')

  if (loading) return <div style={{ padding: 40 }}>로딩 중...</div>

  const sortedResidents = sortData(residents, residentSort.key, residentSort.order)
  const sortedVisitors = sortData(visitors, visitorSort.key, visitorSort.order)

  return (
    <div className="parking-page" style={{ padding: 40, maxWidth: 1200, margin: '0 auto' }}>
      <div className="parking-header">
        <h1 className="parking-title" style={{ fontSize: 32, marginBottom: 30 }}>주차 현황</h1>
        <button className="admin-mode-button" onClick={isAdmin ? exitAdminMode : enterAdminMode}>
          {isAdmin ? '관리자 모드 종료' : '관리자 모드'}
        </button>
      </div>

      {isAdmin && (
        <section className="admin-request-panel">
          <button
            disabled={busy}
            onClick={registerResident}
            style={{
              display: 'block',
              marginBottom: 16,
              padding: '10px 16px',
              fontSize: '15px',
              fontWeight: 'bold',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + 입주 차량 등록
          </button>
          <h2>삭제 요청 ({requests.length}건)</h2>
          {requests.length === 0 ? (
            <p>대기 중인 삭제 요청이 없습니다.</p>
          ) : requests.map(request => (
            <div className="admin-request-row" key={request.id}>
              <span>
                <strong>{request.car_number || '삭제된 차량'}</strong>
                {' · '}{request.target_type === 'resident' ? '입주자' : '방문'} 차량
                {request.description ? ` · ${request.description}` : ''}
              </span>
              <span className="admin-request-actions">
                <button disabled={busy} onClick={() => reviewRequest(request.id, 'approve')}>승인</button>
                <button disabled={busy} onClick={() => reviewRequest(request.id, 'reject')}>반려</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="parking-section" style={{ marginBottom: 40 }}>
        <h2 className="parking-section-title" style={{ fontSize: 24, marginBottom: 15 }}>
          입주자 차량 ({residents.length}대)
        </h2>
        <table className="parking-table resident-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {([['car_number', '차량번호'], ['owner', '호실'], ['spot', '비고']] as const).map(([key, label]) => (
              <th key={key} className={key === 'car_number' ? 'parking-car-number' : key === 'spot' ? 'parking-optional-column' : 'parking-secondary-column'} style={{ ...thTdStyle, cursor: 'pointer' }} onClick={() => toggleSort(residentSort, setResidentSort, key)}>
                {label} <span>{sortIcon(residentSort, key)}</span>
              </th>
            ))}
            <th className="parking-action-column" style={thTdStyle}>작업</th>
          </tr></thead>
          <tbody>{sortedResidents.map(car => (
            <tr key={car.id}>
              <td className="parking-car-number" style={thTdStyle}>{car.car_number}</td>
              <td className="parking-secondary-column" style={thTdStyle}>{car.owner}</td>
              <td className="parking-optional-column" style={thTdStyle}>{car.spot}</td>
              <td className="parking-action-column" style={thTdStyle}>{renderResidentActions(car)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section className="parking-section">
        <h2 className="parking-section-title" style={{ fontSize: 24, marginBottom: 15 }}>
          방문 차량 ({visitors.length}대)
        </h2>
        <table className="parking-table visitor-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {([['car_number', '차량번호'], ['visit_date', '방문일'], ['spot', '방문호수']] as const).map(([key, label]) => (
              <th key={key} className={key === 'car_number' ? 'parking-car-number' : 'parking-secondary-column'} style={{ ...thTdStyle, cursor: 'pointer' }} onClick={() => toggleSort(visitorSort, setVisitorSort, key)}>
                {label} <span>{sortIcon(visitorSort, key)}</span>
              </th>
            ))}
            <th className="parking-action-column" style={thTdStyle}>작업</th>
          </tr></thead>
          <tbody>{sortedVisitors.map(car => (
            <tr key={car.id}>
              <td className="parking-car-number" style={thTdStyle}>{car.car_number}</td>
              <td className="parking-secondary-column" style={thTdStyle}>{car.visit_date ? new Date(car.visit_date).toLocaleDateString('ko-KR') : '-'}</td>
              <td className="parking-secondary-column" style={thTdStyle}>{car.spot}</td>
              <td className="parking-action-column" style={thTdStyle}>{renderRequestButton(car, 'visitor')}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  )
}
