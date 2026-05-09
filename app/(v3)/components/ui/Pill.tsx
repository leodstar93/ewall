import type { ReactNode } from 'react'
import styles from './Pill.module.css'

export type PillTone = 'success' | 'warn' | 'danger' | 'info' | 'neutral'

interface PillProps {
  tone?: PillTone
  children: ReactNode
  dot?: boolean
}

export function Pill({ tone = 'neutral', children, dot = true }: PillProps) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  )
}
