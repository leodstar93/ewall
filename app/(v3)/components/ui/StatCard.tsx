import { Card } from './Card'
import { V3Icon } from './V3Icon'
import styles from './StatCard.module.css'

interface StatCardProps {
  label: string
  value: string
  delta?: string
  deltaTone?: 'up' | 'down'
  sub?: string
  sparkData?: number[]
}

export function StatCard({ label, value, delta, deltaTone, sub, sparkData }: StatCardProps) {
  return (
    <Card padding={18}>
      <div className={styles.top}>
        <div className={styles.label}>{label}</div>
        {delta && (
          <span className={styles.delta} data-tone={deltaTone}>
            <V3Icon name={deltaTone === 'down' ? 'arrowDown' : 'arrowUp'} size={11} stroke={2.2} />
            {delta}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <div>
          <div className={styles.value}>{value}</div>
          {sub && <div className={styles.sub}>{sub}</div>}
        </div>
        {sparkData && <Sparkline data={sparkData} />}
      </div>
    </Card>
  )
}

function Sparkline({ data, w = 84, h = 32 }: { data: number[]; w?: number; h?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  const last = pts.split(' ').at(-1)!.split(',')

  return (
    <svg width={w} height={h} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id="v3sg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--v3-primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--v3-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="url(#v3sg)" stroke="none" />
      <polyline
        points={pts}
        fill="none"
        stroke="var(--v3-primary)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--v3-accent)" />
    </svg>
  )
}
