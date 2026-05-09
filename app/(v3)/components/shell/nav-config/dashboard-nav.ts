import type { NavGroup } from './types'

export const dashboardNavGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview',   label: 'Overview',    href: '/dashboard',           icon: 'grid' },
      { id: 'trucks',     label: 'Fleet',        href: '/dashboard/trucks',    icon: 'truck' },
      { id: 'documents',  label: 'Documents',    href: '/dashboard/documents', icon: 'file' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'ifta',      label: 'IFTA',         href: '/dashboard/ifta-v2',        icon: 'fuel' },
      { id: 'ucr',       label: 'UCR',          href: '/dashboard/ucr',            icon: 'shield' },
      { id: 'form2290',  label: 'Form 2290',    href: '/dashboard/2290',           icon: 'receipt' },
      { id: 'dmv',       label: 'DMV renewals', href: '/dashboard/dmv/renewals',   icon: 'pin' },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'billing',   label: 'Billing',      href: '/dashboard/subscriptions',  icon: 'receipt' },
      { id: 'support',   label: 'Get help',     href: '/dashboard/support',        icon: 'sparkle' },
    ],
  },
]
