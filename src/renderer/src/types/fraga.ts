export type FragaTyp = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'boolean'

export interface AvslutFragaFalt {
  id: string
  label: string
  type: FragaTyp
  required: boolean
  options: string[] | null
}
