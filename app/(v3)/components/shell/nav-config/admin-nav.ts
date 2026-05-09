import type { NavGroup } from './types'

export const adminNavGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview',   label: 'Overview',    href: '/admin',             icon: 'grid' },
      { id: 'fleet',      label: 'Fleet',        href: '/admin/fleet',       icon: 'truck' },
      { id: 'documents',  label: 'Documents',    href: '/admin/documents',   icon: 'file' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'ifta',      label: 'IFTA',         href: '/admin/features/ifta-v2',  icon: 'fuel' },
      { id: 'ucr',       label: 'UCR',          href: '/admin/features/ucr',      icon: 'shield' },
      { id: 'form2290',  label: 'Form 2290',    href: '/admin/features/2290',     icon: 'receipt' },
      { id: 'dmv',       label: 'DMV renewals', href: '/admin/features/dmv',      icon: 'pin' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'truckers',  label: 'Truckers',     href: '/admin/truckers',    icon: 'users' },
      { id: 'team',      label: 'Team',         href: '/admin/users',       icon: 'users' },
    ],
  },
]
