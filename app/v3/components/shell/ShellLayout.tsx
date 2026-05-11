'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import type { NavGroup } from './nav-config/types'
import styles from './ShellLayout.module.css'

interface ShellLayoutProps {
  children: React.ReactNode
  navGroups: NavGroup[]
  title?: string
  breadcrumb?: string[]
  userName?: string
  userRole?: string
  userInitials?: string
  orgName?: string
  settingsHref?: string
}

export function ShellLayout({
  children,
  navGroups,
  title = '',
  breadcrumb = [],
  userName,
  userRole,
  userInitials,
  orgName,
  settingsHref,
}: ShellLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={styles.shell}>
      <Sidebar
        navGroups={navGroups}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        userName={userName}
        userRole={userRole}
        userInitials={userInitials}
        orgName={orgName}
        settingsHref={settingsHref}
      />
      <div className={styles.main}>
        <Topbar title={title} breadcrumb={breadcrumb} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}
