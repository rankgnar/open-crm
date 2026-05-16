import {
  LayoutDashboard, Users, FolderKanban, FileText, TrendingUp, Receipt, ReceiptText,
  CalendarRange, Mail, Calendar, Building2, MessageCircle,
  Users2, ClipboardSignature, ClipboardPlus, Signature, Truck, Upload, Package, type LucideIcon,
} from 'lucide-react'

export interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  popout?: boolean
}

export interface NavGroup {
  label: string | null
  items: NavSection[]
}

// Single source of truth for all navigable sections, organized by category.
// trigger-secciones.ts and Sidebar.tsx both derive from this list.
// Adding a section here automatically makes it available as a trigger target.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { id: 'workspace', label: 'Workspace', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Försäljning',
    items: [
      { id: 'kunder',  label: 'Kunder',  icon: Users,        popout: true },
      { id: 'projekt', label: 'Projekt', icon: FolderKanban, popout: true },
      { id: 'forslag', label: 'Förslag', icon: FileText,     popout: true },
      { id: 'signera', label: 'Signera', icon: Signature,    popout: true },
    ],
  },
  {
    label: 'Projektering',
    items: [
      { id: 'kalender',   label: 'Kalender',   icon: Calendar,            popout: true },
      { id: 'tidplan',    label: 'Tidplan',    icon: CalendarRange,       popout: true },
      { id: 'order',      label: 'Order',      icon: ClipboardSignature,  popout: true },
      { id: 'ata',        label: 'ÄTA',        icon: ClipboardPlus,       popout: true },
    ],
  },
  {
    label: 'Ekonomi',
    items: [
      { id: 'ekonomi',     label: 'Kostnader',   icon: TrendingUp, popout: true },
      { id: 'fakturering', label: 'Fakturering', icon: Receipt,    popout: true },
      { id: 'kvitto',      label: 'Kvitto',      icon: ReceiptText, popout: true },
      { id: 'fortnox',     label: 'Fortnox',     icon: Building2,  popout: true },
    ],
  },
  {
    label: 'Kommunikation',
    items: [
      { id: 'epost',      label: 'E-post',    icon: Mail,          popout: true },
      { id: 'chat',       label: 'Chat',      icon: MessageCircle, popout: true },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'leverantor',  label: 'Leverantör',  icon: Truck,    popout: true },
      { id: 'personal',    label: 'Personal',    icon: Users2,   popout: true },
      { id: 'inventarier', label: 'Inventarier', icon: Package,  popout: true },
    ],
  },
]

// Flat list derived from NAV_GROUPS — used by trigger-secciones and anywhere
// else that needs a single iterable list of all sections.
export const NAV_SECTIONS: NavSection[] = NAV_GROUPS.flatMap((g) => g.items)

// Sections that can receive trigger buttons.
// Includes synthetic sub-section ids that aren't navigable on their own
// but render trigger buttons inside other panels (e.g. projekt:dokument
// renders inside the Dokument tab of a Projekt).
export const TRIGGER_SECTIONS: NavSection[] = [
  ...NAV_SECTIONS,
  { id: 'projekt:dokument', label: 'Projekt — Dokument', icon: Upload },
]
