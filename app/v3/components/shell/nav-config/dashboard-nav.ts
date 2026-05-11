import type { NavGroup } from './types'

export const dashboardNavGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview',   label: 'Overview',    href: '/v3/dashboard',            icon: 'grid' },
      { id: 'trucks',     label: 'Fleet',        href: '/v3/dashboard/trucks',     icon: 'truck',   badge: 8 },
      { id: 'filings',    label: 'Filings',      href: '/v3/dashboard/filings',    icon: 'fuel',    badge: 2 },
      { id: 'documents',  label: 'Documents',    href: '/v3/dashboard/documents',  icon: 'file' },
      { id: 'drivers',    label: 'Drivers',      href: '/v3/dashboard/drivers',    icon: 'users' },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'billing',   label: 'Billing',      href: '/v3/dashboard/billing',    icon: 'receipt' },
      { id: 'support',   label: 'Get help',     href: '/v3/dashboard/support',    icon: 'sparkle' },
    ],
  },
]
