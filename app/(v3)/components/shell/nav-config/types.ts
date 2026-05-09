import type { IconName } from '../../ui/V3Icon'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: IconName
  badge?: number
  permission?: string
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}
