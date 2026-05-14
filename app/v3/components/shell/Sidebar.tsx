'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { EwallLogo } from '../ui/EwallLogo'
import { V3Icon } from '../ui/V3Icon'
import type { NavGroup } from './nav-config/types'
import styles from './Sidebar.module.css'

interface SidebarProps {
  navGroups: NavGroup[]
  collapsed: boolean
  onToggle: () => void
  userName?: string
  userRole?: string
  userInitials?: string
  orgName?: string
  settingsHref?: string
}

export function Sidebar({
  navGroups,
  collapsed,
  onToggle,
  userName,
  userRole,
  userInitials,
  orgName,
  settingsHref,
}: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    const roots = ['/v3/dashboard', '/v3/admin']
    if (roots.includes(href)) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = userInitials ?? (userName?.split(' ').map(p => p[0]).join('').slice(0, 2) ?? '??')

  return (
    <aside
      className={styles.sidebar}
      style={{ width: collapsed ? 'var(--v3-sidebar-w-collapsed)' : 'var(--v3-sidebar-w)' }}
    >
      {/* ── Brand ── */}
      <div className={styles.brand}>
        <div className={styles.logoBox}>
          <EwallLogo size={22} color="#0E1116" />
        </div>
        {!collapsed && (
          <div className={styles.brandText}>
            <span className={styles.brandName}>Ewall</span>
            <span className={styles.brandSub}>{orgName ?? 'Truckers Unidos · Ops'}</span>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        {navGroups.map((group, gi) => (
          <div key={gi} className={styles.group}>
            {!collapsed && group.label && (
              <div className={styles.groupLabel}>{group.label}</div>
            )}
            {group.items.map(item => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={styles.navItem}
                  data-active={active}
                  data-collapsed={collapsed}
                  title={collapsed ? item.label : undefined}
                >
                  {active && !collapsed && <span className={styles.activeBar} aria-hidden />}
                  <V3Icon name={item.icon} size={17} />
                  {!collapsed && (
                    <>
                      <span className={styles.navLabel}>{item.label}</span>
                      {item.badge != null && (
                        <span className={styles.badge} data-active={active}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        {settingsHref && (
          <Link
            href={settingsHref}
            className={styles.settingsBtn}
            data-collapsed={collapsed}
          >
            <V3Icon name="settings" size={17} />
            {!collapsed && <span>Settings</span>}
          </Link>
        )}

        <div className={styles.userRow} data-collapsed={collapsed}>
          <div className={styles.avatar}>{initials}</div>
          {!collapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userName ?? 'Admin'}</span>
              <span className={styles.userRole}>{userRole ?? 'Staff'}</span>
            </div>
          )}
        </div>

        <button className={styles.collapseBtn} onClick={onToggle} type="button">
          <V3Icon name={collapsed ? 'chevRight' : 'chevLeft'} size={12} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
