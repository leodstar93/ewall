'use client'

import { V3Icon } from '../ui/V3Icon'
import styles from './Topbar.module.css'

interface TopbarProps {
  title: string
  breadcrumb?: string[]
}

export function Topbar({ title, breadcrumb }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className={styles.breadcrumbItem}>
                {i > 0 && <span className={styles.sep} aria-hidden>/</span>}
                <span className={i === breadcrumb.length - 1 ? styles.crumbActive : styles.crumb}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} type="button" aria-label="Search">
          <V3Icon name="search" size={16} />
        </button>
        <button className={styles.iconBtn} type="button" aria-label="Notifications" data-badge="true">
          <V3Icon name="bell" size={16} />
          <span className={styles.badgeDot} aria-hidden />
        </button>
      </div>
    </header>
  )
}
