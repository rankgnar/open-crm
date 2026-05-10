import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const CHANNELS = [
  'db:chat:list-summary',
  'db:chat:list-thread',
  'db:chat:send-as-admin',
  'db:chat:mark-read',
  'db:chat:unread-total',
] as const

export interface ChatMessage {
  id: string
  personal_id: string
  fran_admin: boolean
  innehall: string
  skapad_at: string
}

export interface ChatThreadSummary {
  personal_id: string
  namn: string
  status: string
  email: string | null
  last_at: string | null
  last_innehall: string | null
  last_fran_admin: boolean | null
  unread_count: number
}

export function registerChatHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:chat:list-summary', async (): Promise<ChatThreadSummary[]> => {
    const { data: personalRaw, error: pErr } = await supabase
      .from('personal')
      .select('id, namn, status, email, admin_last_read_chat_at')
      .order('namn', { ascending: true })
    if (pErr) throw new Error(pErr.message)

    const personal = (personalRaw ?? []).filter(
      (p) => (p.status as string | null)?.toLowerCase() !== 'inaktiv',
    )

    const { data: messagesRaw, error: mErr } = await supabase
      .from('personal_chat')
      .select('personal_id, fran_admin, innehall, skapad_at')
      .order('skapad_at', { ascending: false })
    if (mErr) throw new Error(mErr.message)

    const activeIds = new Set(personal.map((p) => p.id as string))
    const messages = (messagesRaw ?? []).filter((m) => activeIds.has(m.personal_id as string))

    const lastByPersonal = new Map<string, { innehall: string; skapad_at: string; fran_admin: boolean }>()
    const unreadByPersonal = new Map<string, number>()

    for (const row of messages ?? []) {
      const pid = row.personal_id as string
      if (!lastByPersonal.has(pid)) {
        lastByPersonal.set(pid, {
          innehall: row.innehall as string,
          skapad_at: row.skapad_at as string,
          fran_admin: row.fran_admin as boolean,
        })
      }
    }

    for (const p of personal ?? []) {
      const lastRead = (p as { admin_last_read_chat_at: string | null }).admin_last_read_chat_at
      const lastReadMs = lastRead ? Date.parse(lastRead) : 0
      const count = (messages ?? []).filter((m) =>
        m.personal_id === p.id
        && m.fran_admin === false
        && Date.parse(m.skapad_at as string) > lastReadMs,
      ).length
      unreadByPersonal.set(p.id as string, count)
    }

    return (personal ?? []).map((p) => {
      const last = lastByPersonal.get(p.id as string)
      return {
        personal_id: p.id as string,
        namn: p.namn as string,
        status: p.status as string,
        email: (p.email as string | null) ?? null,
        last_at: last?.skapad_at ?? null,
        last_innehall: last?.innehall ?? null,
        last_fran_admin: last?.fran_admin ?? null,
        unread_count: unreadByPersonal.get(p.id as string) ?? 0,
      }
    })
  })

  ipcMain.handle('db:chat:list-thread', async (_, personal_id: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from('personal_chat')
      .select('*')
      .eq('personal_id', personal_id)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as ChatMessage[]
  })

  ipcMain.handle('db:chat:send-as-admin', async (_, personal_id: string, innehall: string): Promise<ChatMessage> => {
    const { data, error } = await supabase
      .from('personal_chat')
      .insert({ personal_id, fran_admin: true, innehall })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as ChatMessage
  })

  ipcMain.handle('db:chat:mark-read', async (_, personal_id: string): Promise<void> => {
    const { error } = await supabase
      .from('personal')
      .update({ admin_last_read_chat_at: new Date().toISOString() })
      .eq('id', personal_id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:chat:unread-total', async (): Promise<number> => {
    const { data: personalRaw, error: pErr } = await supabase
      .from('personal')
      .select('id, status, admin_last_read_chat_at')
    if (pErr) throw new Error(pErr.message)

    const personal = (personalRaw ?? []).filter(
      (p) => (p.status as string | null)?.toLowerCase() !== 'inaktiv',
    )

    const { data: messages, error: mErr } = await supabase
      .from('personal_chat')
      .select('personal_id, fran_admin, skapad_at')
      .eq('fran_admin', false)
    if (mErr) throw new Error(mErr.message)

    const lastRead = new Map<string, number>()
    for (const p of personal) {
      const ts = (p as { admin_last_read_chat_at: string | null }).admin_last_read_chat_at
      lastRead.set(p.id as string, ts ? Date.parse(ts) : 0)
    }

    let total = 0
    for (const m of messages ?? []) {
      const ts = Date.parse(m.skapad_at as string)
      const personalId = m.personal_id as string
      if (!lastRead.has(personalId)) continue
      if (ts > (lastRead.get(personalId) ?? 0)) total++
    }
    return total
  })
}
