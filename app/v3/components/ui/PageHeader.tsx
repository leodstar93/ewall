import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: string[]
  action?: ReactNode
}

export function PageHeader({ title, subtitle, breadcrumb, action }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {breadcrumb && (
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className={styles.sep} aria-hidden>/</span>}
                <span className={i === breadcrumb.length - 1 ? styles.crumbActive : styles.crumb}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
