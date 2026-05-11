import type { NavGroup } from './types'

export const adminNavGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview',   label: 'Overview',    href: '/v3/admin',           icon: 'grid' },
      { id: 'documents',  label: 'Documents',   href: '/v3/admin/documents', icon: 'file' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'ifta',     label: 'IFTA',         href: '/v3/admin/features/ifta-v2', icon: 'fuel',    badge: 3 },
      { id: 'ucr',      label: 'UCR',          href: '/v3/admin/features/ucr',     icon: 'shield' },
      { id: 'form2290', label: 'Form 2290',    href: '/v3/admin/features/2290',    icon: 'receipt' },
      { id: 'dmv',      label: 'DMV renewals', href: '/v3/admin/features/dmv',     icon: 'pin',     badge: 7 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'reports', label: 'Reports', href: '/v3/admin/reports', icon: 'chart' },
      { id: 'team',    label: 'Team',    href: '/v3/admin/users',   icon: 'users' },
    ],
  },
]

export const staffNavGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview',  label: 'Overview',   href: '/v3/admin',           icon: 'grid' },
      { id: 'documents', label: 'Documents',  href: '/v3/admin/documents', icon: 'file' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'ifta',     label: 'IFTA',         href: '/v3/admin/features/ifta-v2', icon: 'fuel',    badge: 3 },
      { id: 'ucr',      label: 'UCR',          href: '/v3/admin/features/ucr',     icon: 'shield' },
      { id: 'form2290', label: 'Form 2290',    href: '/v3/admin/features/2290',    icon: 'receipt' },
      { id: 'dmv',      label: 'DMV renewals', href: '/v3/admin/features/dmv',     icon: 'pin',     badge: 7 },
    ],
  },
]
