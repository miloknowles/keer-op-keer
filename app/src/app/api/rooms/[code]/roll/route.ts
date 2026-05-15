import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rollDice } from '@/lib/game/dice'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: room } = await supabase
    .from('rooms')
    .select('id, status, current_player_index, round_number')
    .eq('code', code.toLowerCase())
    .maybeSingle()
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.status !== 'in_progress') {
    return NextResponse.json({ error: 'Game is not in progress' }, { status: 409 })
  }

  const { data: me } = await supabase
    .from('room_players')
    .select('id, seat_index')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!me) return NextResponse.json({ error: 'Not in room' }, { status: 403 })
  if (me.seat_index !== room.current_player_index) {
    return NextResponse.json({ error: 'Not your turn' }, { status: 403 })
  }

  // Prevent re-rolling an already-rolled round
  const { data: existing } = await supabase
    .from('room_history')
    .select('id')
    .eq('room_id', room.id)
    .eq('round_number', room.round_number)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Already rolled this round' }, { status: 409 })

  const dice = rollDice()
  const { error } = await supabase
    .from('room_history')
    .insert({
      room_id: room.id,
      round_number: room.round_number,
      active_player_id: me.id,
      dice_colors: dice.colors,
      dice_numbers: dice.numbers,
      dice_special: dice.special,
    })
  if (error) {
    console.error('[roll] insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
