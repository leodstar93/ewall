import type { NavGroup } from './types'

export const adminNavGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview',   label: 'Overview',    href: '/v3/admin',             icon: 'grid' },
      { id: 'fleet',      label: 'Fleet',        href: '/v3/admin/fleet',       icon: 'truck' },
      { id: 'documents',  label: 'Documents',    href: '/v3/admin/documents',   icon: 'file' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'ifta',      label: 'IFTA',         href: '/v3/admin/features/ifta-v2',  icon: 'fuel' },
      { id: 'ucr',       label: 'UCR',          href: '/v3/admin/features/ucr',      icon: 'shield' },
      { id: 'form2290',  label: 'Form 2290',    href: '/v3/admin/features/2290',     icon: 'receipt' },
      { id: 'dmv',       label: 'DMV renewals', href: '/v3/admin/features/dmv',      icon: 'pin' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'truckers',  label: 'Truckers',     href: '/v3/admin/truckers',    icon: 'users' },
      { id: 'team',      label: 'Team',         href: '/v3/admin/users',       icon: 'users' },
    ],
  },
]
