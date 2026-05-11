import type { CSSProperties, ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  padding?: number | string
  noPadding?: boolean
}

export function Card({ children, className, style, padding = 20, noPadding }: CardProps) {
  return (
    <div
      className={`${styles.card}${className ? ` ${className}` : ''}`}
      style={{ padding: noPadding ? 0 : padding, ...style }}
    >
      {children}
    </div>
  )
}
