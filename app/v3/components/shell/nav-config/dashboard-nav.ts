import type { NavGroup } from './types'

export const dashboardNavGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview',   label: 'Overview',    href: '/v3/dashboard',            icon: 'grid' },
      { id: 'trucks',     label: 'Fleet',        href: '/v3/dashboard/trucks',     icon: 'truck' },
      { id: 'filings',    label: 'Filings',      href: '/v3/dashboard/filings',    icon: 'fuel' },
      { id: 'documents',  label: 'Documents',    href: '/v3/dashboard/documents',  icon: 'file' },
      { id: 'drivers',    label: 'Drivers',      href: '/v3/dashboard/drivers',    icon: 'users' },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'company',      label: 'Company profile', href: '/v3/dashboard/company',       icon: 'shield'   },
      { id: 'billing-plan', label: 'Billing & Plan',  href: '/v3/dashboard/billing',        icon: 'receipt'  },
      { id: 'integrations', label: 'Integrations',    href: '/v3/dashboard/integrations',   icon: 'sparkle'  },
      { id: 'settings',     label: 'Settings',        href: '/v3/dashboard/settings',       icon: 'settings' },
      { id: 'support',      label: 'Get help',        href: '/v3/dashboard/support',        icon: 'sparkle'  },
    ],
  },
]
