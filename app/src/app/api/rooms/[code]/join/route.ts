import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const display_name = (body.display_name ?? '').trim()
  if (!display_name) return NextResponse.json({ error: 'display_name required' }, { status: 400 })

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, status')
    .eq('code', code.toLowerCase())
    .maybeSingle()
  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 })
  if (!room) return NextResponse.json({ error: 'Room not found. Make sure your code is valid.' }, { status: 404 })
  if (room.status !== 'lobby') {
    return NextResponse.json({ error: 'Game already started' }, { status: 409 })
  }

  // Idempotent: return existing player_id if already a member
  const { data: existing } = await supabase
    .from('room_players')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) return NextResponse.json({ player_id: existing.id })

  // Count check
  const { count } = await supabase
    .from('room_players')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id)
  if ((count ?? 0) >= 6) {
    return NextResponse.json({ error: 'Room is full' }, { status: 409 })
  }

  // Find next available seat_index
  const { data: seats } = await supabase
    .from('room_players')
    .select('seat_index')
    .eq('room_id', room.id)
  const used = new Set((seats ?? []).map((p) => p.seat_index))
  let seat_index = 0
  while (used.has(seat_index)) seat_index++

  const { data: player, error: insertErr } = await supabase
    .from('room_players')
    .insert({ room_id: room.id, user_id: user.id, display_name, seat_index })
    .select('id')
    .single()
  if (insertErr || !player) {
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to join' }, { status: 500 })
  }

  return NextResponse.json({ player_id: player.id })
}
