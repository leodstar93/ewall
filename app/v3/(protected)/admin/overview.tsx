'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { StatCard } from '@/app/v3/components/ui/StatCard'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import styles from './overview.module.css'

// ── Static data (replace with real API calls per module) ──────────────────────

const STATS = [
  {
    label: 'Open compliance items',
    value: '11',
    delta: '−4',
    deltaTone: 'down' as const,
    sub: 'vs last week',
    sparkData: [8, 11, 9, 12, 14, 13, 11],
  },
  {
    label: 'Filings processed · MTD',
    value: '38',
    delta: '+22%',
    deltaTone: 'up' as const,
    sub: '$48,210 collected',
    sparkData: [10, 14, 18, 22, 28, 32, 38],
  },
  {
    label: 'Active units on road',
    value: '18',
    sub: 'of 24 total · 75% utilization',
    sparkData: [12, 14, 16, 17, 16, 18, 18],
  },
  {
    label: 'Avg. cost per filing',
    value: '$268',
    delta: '−$12',
    deltaTone: 'down' as const,
    sub: 'last 30 days',
    sparkData: [310, 295, 290, 280, 274, 270, 268],
  },
]

const FILINGS_QUEUE: {
  id: string; kind: string; label: string; due: string
  status: string; tone: PillTone; units: number; amount: number; progress: number
}[] = [
  { id: 'IFTA-26-Q2', kind: 'IFTA',  label: 'IFTA · 2026 Q2',           due: 'Due Jul 31',     status: 'In review',        tone: 'warn',    units: 18, amount: 4280,  progress: 62 },
  { id: 'UCR-2026',   kind: 'UCR',   label: 'UCR · 2026 Annual',         due: 'Due in 12 days', status: 'Awaiting payment', tone: 'info',    units: 24, amount: 525,   progress: 78 },
  { id: 'DMV-TX-12',  kind: 'DMV',   label: 'TX registration · 12 trucks',due: 'Renews May 18', status: 'Action needed',    tone: 'danger',  units: 12, amount: 8160,  progress: 40 },
  { id: '2290-26',    kind: '2290',  label: 'Form 2290 · FY 2026',       due: 'Filed Apr 02',   status: 'Approved',         tone: 'success', units: 24, amount: 13200, progress: 100 },
]

const FLEET: {
  id: string; model: string; driver: string; loc: string
  load: string; miles: number; status: string; tone: PillTone
}[] = [
  { id: 'TRK-101', model: 'Freightliner Cascadia', driver: 'José Rivera',   loc: 'Dallas, TX',          load: 'Auto parts',      miles: 1240, status: 'Active',      tone: 'success' },
  { id: 'TRK-214', model: 'Volvo VNL 760',         driver: 'Ana Morales',   loc: 'Phoenix, AZ',         load: 'Produce',          miles: 980,  status: 'In transit',  tone: 'info' },
  { id: 'TRK-309', model: 'Kenworth T680',          driver: 'Luis Martínez', loc: 'San Bernardino, CA',  load: 'Maintenance hold', miles: 0,    status: 'Maintenance', tone: 'warn' },
  { id: 'TRK-411', model: 'Peterbilt 579',          driver: 'Marcos Díaz',  loc: 'Laredo, TX',          load: 'Dry goods',        miles: 720,  status: 'Active',      tone: 'success' },
  { id: 'TRK-550', model: 'International LT',       driver: 'Sofía Pérez',  loc: 'Miami, FL',           load: 'Unassigned',       miles: 0,    status: 'Idle',        tone: 'neutral' },
]

const ACTIVITY: {
  who: string; what: string; when: string
  icon: 'fuel' | 'check' | 'upload' | 'shield'
  tone?: 'success' | 'warn'
}[] = [
  { who: 'Ana Morales', what: 'submitted IFTA Q2 fuel summary',             when: '12 min ago', icon: 'fuel' },
  { who: 'System',      what: 'auto-renewed UCR registration for 24 units', when: '1 hr ago',   icon: 'check',  tone: 'success' },
  { who: 'Juan García', what: 'uploaded 6 receipts to Documents',           when: '3 hr ago',   icon: 'upload' },
  { who: 'TX DMV',      what: 'flagged TRK-309 registration as expiring',   when: 'Yesterday',  icon: 'shield', tone: 'warn' },
  { who: 'José Rivera', what: 'completed pre-trip inspection',               when: 'Yesterday',  icon: 'check',  tone: 'success' },
]

const WEEK_PAYMENTS = [
  { date: 'Mon · May 11', label: 'TX registration · 4 units', amount: 2720 },
  { date: 'Wed · May 13', label: 'IFTA Q2 deposit',           amount: 4280 },
  { date: 'Fri · May 15', label: 'UCR balance',               amount: 525 },
]

const FLEET_FILTERS = ['All', 'Active', 'In transit', 'Maintenance', 'Idle'] as const
type FleetFilter = typeof FLEET_FILTERS[number]

const TONE_BAR: Record<PillTone, string> = {
  success: 'var(--v3-success)',
  danger:  'var(--v3-danger)',
  warn:    'var(--v3-warn)',
  info:    'var(--v3-primary)',
  neutral: 'var(--v3-muted)',
}

const ICON_BG: Record<string, string> = {
  success: 'var(--v3-success-bg)',
  warn:    'var(--v3-warn-bg)',
  default: 'var(--v3-primary-soft)',
}
const ICON_COLOR: Record<string, string> = {
  success: 'var(--v3-success)',
  warn:    'var(--v3-warn)',
  default: 'var(--v3-primary)',
}

// ── Section components ────────────────────────────────────────────────────────

function GreetingStrip({ firstName }: { firstName: string }) {
  return (
    <div style={{
      background: 'var(--v3-primary)',
      borderRadius: 14,
      color: '#fff',
      padding: '22px 26px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* decorative accent blur */}
      <div style={{
        position: 'absolute', right: -40, top: -40,
        width: 220, height: 220, borderRadius: '50%',
        background: 'rgba(181,137,90,0.15)',
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', flex: 1 }}>
        <div style={{ fontSize: 11.5, opacity: 0.7, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
          Q2 2026 · Week 19
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, letterSpacing: -0.4, lineHeight: 1.3 }}>
          Buenos días, {firstName}.{' '}
          <span style={{ opacity: 0.65 }}>You have 3 filings closing this week.</span>
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
          Texas registration packet for 12 trucks needs your sign-off before Sunday.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, position: 'relative', flexShrink: 0 }}>
        <button type="button" style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', padding: '9px 14px', borderRadius: 8,
          fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
        }}>
          View week plan
        </button>
        <button type="button" style={{
          background: 'var(--v3-accent)', border: 'none', color: '#0E1116',
          padding: '9px 16px', borderRadius: 8,
          fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          Review packet <V3Icon name="arrow" size={13} stroke={2} />
        </button>
      </div>
    </div>
  )
}

function ComplianceQueue() {
  return (
    <Card noPadding>
      <div style={{ padding: '18px 20px 12px' }}>
        <SectionHeader
          title="Compliance queue"
          subtitle="Active filings ranked by deadline"
          action={
            <button type="button" style={{
              fontSize: 12, color: 'var(--v3-ink)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'inherit', fontWeight: 500,
            }}>
              View all <V3Icon name="arrow" size={12} />
            </button>
          }
        />
      </div>
      {FILINGS_QUEUE.map((f, i) => (
        <div key={f.id} style={{
          display: 'grid',
          gridTemplateColumns: '110px 1fr 155px 130px 90px 28px',
          alignItems: 'center',
          gap: 14,
          padding: '14px 20px',
          borderTop: `1px solid var(${i === 0 ? '--v3-line' : '--v3-soft-line'})`,
        }}>
          <span style={{
            background: 'var(--v3-chip-bg)', color: 'var(--v3-ink)',
            padding: '3px 9px', borderRadius: 6,
            fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
            justifySelf: 'start',
          }}>
            {f.kind}
          </span>

          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--v3-ink)' }}>{f.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 2 }}>
              {f.due} · {f.units} units
            </div>
          </div>

          <Pill tone={f.tone}>{f.status}</Pill>

          <div>
            <div style={{ height: 4, background: 'var(--v3-soft-line)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${f.progress}%`, height: '100%',
                background: TONE_BAR[f.tone], borderRadius: 2,
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 4 }}>
              {f.progress}% complete
            </div>
          </div>

          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--v3-ink)',
            textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          }}>
            ${f.amount.toLocaleString()}
          </div>

          <button type="button" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--v3-muted)', padding: 4, borderRadius: 6,
          }}>
            <V3Icon name="more" size={16} />
          </button>
        </div>
      ))}
    </Card>
  )
}

function FleetSnapshot() {
  const [filter, setFilter] = useState<FleetFilter>('All')
  const rows = FLEET.filter(t => filter === 'All' || t.status === filter)
  const activeCount = FLEET.filter(t => t.status === 'Active' || t.status === 'In transit').length

  return (
    <Card noPadding>
      <div style={{ padding: '18px 20px 12px' }}>
        <SectionHeader
          title="Fleet snapshot"
          subtitle={`${FLEET.length} units · ${activeCount} on the road`}
          action={
            <div style={{
              display: 'flex', gap: 4,
              background: 'var(--v3-soft-line)',
              padding: 3, borderRadius: 7,
            }}>
              {FLEET_FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 10px', fontSize: 11.5, borderRadius: 5,
                    border: 'none', cursor: 'pointer',
                    background: filter === f ? 'var(--v3-panel)' : 'transparent',
                    color: filter === f ? 'var(--v3-ink)' : 'var(--v3-muted)',
                    fontWeight: filter === f ? 500 : 400,
                    boxShadow: filter === f ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    fontFamily: 'inherit',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{
            borderTop: '1px solid var(--v3-line)',
            borderBottom: '1px solid var(--v3-line)',
            background: 'var(--v3-bg)',
          }}>
            {['Unit', 'Driver', 'Location', 'Current load', 'Miles · 7d', 'Status'].map((h, i) => (
              <th key={h} style={{
                textAlign: i >= 4 ? 'right' : 'left',
                padding: '9px 20px',
                fontSize: 10.5, color: 'var(--v3-muted)',
                fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 12.5 }}>
                No trucks matching this filter
              </td>
            </tr>
          ) : rows.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
              <td style={{ padding: '13px 20px' }}>
                <div style={{ fontWeight: 500, color: 'var(--v3-ink)' }}>{t.id}</div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{t.model}</div>
              </td>
              <td style={{ padding: '13px 20px', color: 'var(--v3-ink)' }}>{t.driver}</td>
              <td style={{ padding: '13px 20px', color: 'var(--v3-ink)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <V3Icon name="pin" size={12} /> {t.loc}
                </span>
              </td>
              <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>{t.load}</td>
              <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>
                {t.miles.toLocaleString()}
              </td>
              <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                <Pill tone={t.tone}>{t.status}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function MiniFleetMap() {
  const pins = [
    { x: 28, y: 58, color: 'var(--v3-success)' },
    { x: 22, y: 50, color: 'var(--v3-info)' },
    { x: 18, y: 48, color: 'var(--v3-warn)' },
    { x: 38, y: 62, color: 'var(--v3-success)' },
    { x: 75, y: 58, color: 'var(--v3-muted)' },
    { x: 50, y: 40, color: 'var(--v3-info)' },
    { x: 60, y: 50, color: 'var(--v3-success)' },
  ]
  const legend = [
    { l: 'Active', n: 3, c: 'var(--v3-success)' },
    { l: 'Transit', n: 2, c: 'var(--v3-info)' },
    { l: 'Service', n: 1, c: 'var(--v3-warn)' },
    { l: 'Idle',   n: 1, c: 'var(--v3-muted)' },
  ]
  return (
    <Card noPadding style={{ overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 12px' }}>
        <SectionHeader
          title="Live fleet"
          subtitle="7 units broadcasting"
          action={<Pill tone="success">Live</Pill>}
        />
      </div>
      <div style={{
        height: 200,
        position: 'relative',
        background: 'linear-gradient(180deg, var(--v3-bg) 0%, var(--v3-soft-line) 100%)',
        borderTop: '1px solid var(--v3-line)',
      }}>
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <path
            d="M5 25 L12 18 L20 16 L28 18 L35 14 L45 12 L55 14 L65 12 L75 14 L82 18 L88 22 L92 28 L90 36 L85 42 L78 46 L70 48 L60 50 L50 52 L40 50 L30 48 L22 44 L15 38 L8 32 Z"
            fill="var(--v3-panel)" stroke="var(--v3-line)" strokeWidth="0.4"
          />
          <path d="M30 18 L32 50 M50 12 L52 52 M70 14 L72 48" stroke="var(--v3-line)" strokeWidth="0.3" fill="none" />
          <path d="M8 32 L92 28 M5 25 L88 22" stroke="var(--v3-line)" strokeWidth="0.3" fill="none" />
        </svg>

        {pins.map((p, i) => (
          <div
            key={i}
            style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: p.color,
              border: '2px solid #fff',
              boxShadow: `0 0 0 4px ${p.color}33`,
            }} />
          </div>
        ))}

        <div style={{
          position: 'absolute', bottom: 12, left: 14, right: 14,
          background: 'var(--v3-panel)', border: '1px solid var(--v3-line)',
          borderRadius: 8, padding: '8px 12px',
          display: 'flex', justifyContent: 'space-between', gap: 10,
        }}>
          {legend.map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.c, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--v3-muted)' }}>{s.l}</span>
              <span style={{ fontSize: 12, color: 'var(--v3-ink)', fontWeight: 600 }}>{s.n}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function ActivityFeed() {
  return (
    <Card>
      <SectionHeader title="Recent activity" subtitle="Across the team and integrations" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ACTIVITY.map((a, i) => {
          const key = a.tone ?? 'default'
          return (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: ICON_BG[key],
                color: ICON_COLOR[key],
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <V3Icon name={a.icon} size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 500 }}>{a.who}</span>
                  <span style={{ color: 'var(--v3-muted)' }}> {a.what}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{a.when}</div>
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" style={{
        marginTop: 16, width: '100%', padding: 8,
        background: 'transparent', border: '1px solid var(--v3-line)',
        borderRadius: 7, fontSize: 12, color: 'var(--v3-ink)',
        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
      }}>
        View full activity log
      </button>
    </Card>
  )
}

function FooterBand() {
  return (
    <div className={styles.footer}>
      {/* Smart assistant */}
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <V3Icon name="sparkle" size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)' }}>
              Smart filing assistant
            </div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Auto-detect missing IFTA mileage from ELD data and suggest corrections before submission.
            </div>
            <button type="button" style={{
              marginTop: 10, fontSize: 12, color: 'var(--v3-ink)',
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              Try beta <V3Icon name="arrow" size={11} />
            </button>
          </div>
        </div>
      </Card>

      {/* This week's payments */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 14 }}>
          This week&apos;s payments
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {WEEK_PAYMENTS.map(p => (
            <div key={p.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--v3-soft-line)',
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--v3-ink)', fontWeight: 500 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{p.date}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)', fontVariantNumeric: 'tabular-nums' }}>
                ${p.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Need a hand */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 4 }}>
          Need a hand?
        </div>
        <div style={{ fontSize: 12, color: 'var(--v3-muted)', lineHeight: 1.5 }}>
          Our Spanish-speaking compliance team is on standby weekdays 7am – 7pm CT.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" style={{
            flex: 1, padding: '8px 10px', fontSize: 12, borderRadius: 7,
            background: 'var(--v3-primary)', color: '#fff',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}>
            Chat with ops
          </button>
          <button type="button" style={{
            flex: 1, padding: '8px 10px', fontSize: 12, borderRadius: 7,
            background: 'var(--v3-panel)', color: 'var(--v3-ink)',
            border: '1px solid var(--v3-line)',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}>
            Schedule call
          </button>
        </div>
      </Card>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AdminOverview({ userName }: { userName: string }) {
  const firstName = userName.split(' ')[0]
  return (
    <div className={styles.page}>
      <GreetingStrip firstName={firstName} />

      <div className={styles.stats}>
        {STATS.map(s => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <ComplianceQueue />

      <div className={styles.lower}>
        <FleetSnapshot />
        <div className={styles.sideCol}>
          <MiniFleetMap />
          <ActivityFeed />
        </div>
      </div>

      <FooterBand />
    </div>
  )
}
