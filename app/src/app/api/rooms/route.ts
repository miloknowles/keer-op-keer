import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRoomCode } from '@/lib/utils'
import boardConfig from '@/boards/kok2-standard.json'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const display_name = (body.display_name ?? '').trim()
  if (!display_name) return NextResponse.json({ error: 'display_name required' }, { status: 400 })

  // Generate unique 4-letter code (retry on collision)
  let code: string | null = null
  for (let i = 0; i < 5; i++) {
    const candidate = generateRoomCode()
    const { data: existing } = await supabase
      .from('rooms').select('id').eq('code', candidate).maybeSingle()
    if (!existing) { code = candidate; break }
  }
  if (!code) return NextResponse.json({ error: 'Could not generate room code' }, { status: 500 })

  // 1. Room row (host_id null initially — rooms_update policy allows this via the IS NULL branch)
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({ code, status: 'lobby', host_id: null })
    .select('id')
    .single()
  if (roomErr || !room) {
    return NextResponse.json({ error: roomErr?.message ?? 'Failed to create room' }, { status: 500 })
  }

  // 2. Board config row
  const { error: boardErr } = await supabase
    .from('room_boards')
    .insert({ room_id: room.id, template_id: 'kok2-standard', config: boardConfig })
  if (boardErr) {
    return NextResponse.json({ error: boardErr.message }, { status: 500 })
  }

  // 3. Host player row
  const { data: player, error: playerErr } = await supabase
    .from('room_players')
    .insert({ room_id: room.id, user_id: user.id, display_name, seat_index: 0 })
    .select('id')
    .single()
  if (playerErr || !player) {
    return NextResponse.json({ error: playerErr?.message ?? 'Failed to create player' }, { status: 500 })
  }

  // 4. Set host_id now that player row exists
  const { error: updateErr } = await supabase
    .from('rooms')
    .update({ host_id: player.id })
    .eq('id', room.id)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ code })
}
