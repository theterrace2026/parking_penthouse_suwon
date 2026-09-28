import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { isAdmin } from '@/app/lib/adminAuth'

function requireFields(carNumber: unknown, owner: unknown, spot: unknown) {
  return typeof carNumber === 'string' && carNumber.trim() &&
    typeof owner === 'string' && owner.trim() &&
    typeof spot === 'string' && spot.trim()
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { carNumber, owner, spot } = await request.json()
    if (!requireFields(carNumber, owner, spot)) {
      return NextResponse.json({ error: '차량번호, 호실, 비고를 입력하세요.' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    await sql`
      INSERT INTO residents (car_number, owner, spot)
      VALUES (${carNumber.trim()}, ${owner.trim()}, ${spot.trim()})
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Register resident error:', error)
    return NextResponse.json({ error: '등록에 실패했습니다. 이미 등록된 차량번호일 수 있습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { id, carNumber, owner, spot } = await request.json()
    const targetId = Number(id)
    if (!Number.isInteger(targetId) || targetId <= 0 || !requireFields(carNumber, owner, spot)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    await sql`
      UPDATE residents SET car_number = ${carNumber.trim()}, owner = ${owner.trim()}, spot = ${spot.trim()}
      WHERE id = ${targetId}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update resident error:', error)
    return NextResponse.json({ error: '수정에 실패했습니다. 이미 등록된 차량번호일 수 있습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))

  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: '직접 삭제는 허용되지 않습니다. 삭제 요청 API를 이용하세요.' },
      { status: 405 }
    )
  }

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`DELETE FROM residents WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete resident error:', error)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
}
