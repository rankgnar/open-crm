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
