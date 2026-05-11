import type { Metadata } from 'next'
import styles from './layout.module.css'

export const metadata: Metadata = {
  title: 'Ewall · Truckers Unidos',
  description: 'Trucking compliance operations platform',
}

export default function V3RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.v3Root}>
      {children}
    </div>
  )
}
