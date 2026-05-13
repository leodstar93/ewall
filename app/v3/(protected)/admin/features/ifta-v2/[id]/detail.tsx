'use client'

import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/filing-detail.module.css'

const IFTA_STEPS = [
  { label: 'Draft',     statuses: ['DRAFT', 'SYNCING'] },
  { label: 'Data\nReady', statuses: ['DATA_READY', 'NEEDS_REVIEW', 'READY_FOR_REVIEW'] },
  { label: 'In\nReview', statuses: ['IN_REVIEW', 'CHANGES_REQUESTED'] },
  { label: 'Approved',  statuses: ['SNAPSHOT_READY', 'PENDING_APPROVAL', 'APPROVED'] },
  { label: 'Finalized', statuses: ['FINALIZED', 'REOPENED', 'ARCHIVED'] },
]

function StepTracker({ statusRaw }: { statusRaw: string }) {
  const currentIdx = IFTA_STEPS.findIndex(st => st.statuses.includes(statusRaw))
  return (
    <Card>
      <div className={s.steps}>
        {IFTA_STEPS.map((st, i) => {
          const done = i < currentIdx
          const current = i === currentIdx
          return (
            <div key={st.label} className={s.step} data-done={done} data-current={current}>
              <div className={s.stepDot}>{done ? '✓' : i + 1}</div>
              <div className={s.stepLabel} style={{ whiteSpace: 'pre-line' }}>{st.label}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function severityTone(sev: string): PillTone {
  if (sev === 'ERROR' || sev === 'BLOCKING') return 'danger'
  if (sev === 'WARNING') return 'warn'
  return 'info'
}

interface Props {
  id: string
  year: number
  quarter: number
  status: string
  statusRaw: string
  tone: PillTone
  tenantName: string
  periodStart: string
  periodEnd: string
  totalMiles: number | null
  totalGallons: number | null
  totalNetTax: number | null
  notesInternal: string | null
  notesClientVisible: string | null
  createdAt: string
  updatedAt: string
  jurisdictions: { state: string; miles: number; taxableGals: number; taxRate: number; taxDue: number; netTax: number }[]
  exceptions: { id: string; severity: string; status: string; title: string; description: string | null; jurisdiction: string | null; detectedAt: string }[]
  auditLog: { id: string; action: string; message: string | null; when: string }[]
}

export function IftaFilingDetail({ year, quarter, status, statusRaw, tone, tenantName, periodStart, periodEnd, totalMiles, totalGallons, totalNetTax, notesInternal, notesClientVisible, createdAt, updatedAt, jurisdictions, exceptions, auditLog }: Props) {
  const openExceptions = exceptions.filter(e => e.status === 'OPEN')

  const actions: { label: string; type: 'primary' | 'secondary' | 'danger' }[] = (() => {
    switch (statusRaw) {
      case 'DRAFT': case 'SYNCING':       return [{ label: 'Mark data ready', type: 'primary' }]
      case 'DATA_READY': case 'NEEDS_REVIEW': return [{ label: 'Start review', type: 'primary' }, { label: 'Request changes', type: 'secondary' }]
      case 'READY_FOR_REVIEW':            return [{ label: 'Begin review', type: 'primary' }]
      case 'IN_REVIEW':                   return [{ label: 'Approve', type: 'primary' }, { label: 'Request changes', type: 'secondary' }]
      case 'CHANGES_REQUESTED':           return [{ label: 'Mark resolved', type: 'primary' }]
      case 'SNAPSHOT_READY': case 'PENDING_APPROVAL': return [{ label: 'Approve', type: 'primary' }]
      case 'APPROVED':                    return [{ label: 'Finalize', type: 'primary' }]
      default:                            return []
    }
  })()

  return (
    <div className={s.wrapper}>
      {/* Header */}
      <div className={s.header}>
        <Link href="/v3/admin/features/ifta-v2" className={s.backBtn}>
          <V3Icon name="chevLeft" size={13} /> IFTA filings
        </Link>
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <h1 className={s.title}>IFTA · {year} Q{quarter}</h1>
            <Pill tone={tone}>{status}</Pill>
            {openExceptions.length > 0 && (
              <Pill tone="danger">{openExceptions.length} exceptions</Pill>
            )}
          </div>
          <div className={s.sub}>{tenantName} · {periodStart} – {periodEnd}</div>
        </div>
        <div className={s.headerActions}>
          {actions.map(a => (
            <button key={a.label} className={s[`btn${a.type.charAt(0).toUpperCase() + a.type.slice(1)}` as 'btnPrimary' | 'btnSecondary' | 'btnDanger']} type="button">
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step tracker */}
      <StepTracker statusRaw={statusRaw} />

      {/* Body */}
      <div className={s.body}>
        {/* Main */}
        <div className={s.main}>
          {/* Filing info */}
          <Card>
            <SectionHeader title="Filing details" />
            <div className={s.metaGrid}>
              <div className={s.metaItem}><span className={s.metaLabel}>Tenant</span><span className={s.metaValue}>{tenantName}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Period</span><span className={s.metaValue}>{periodStart} – {periodEnd}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Total miles</span><span className={s.metaValue}>{totalMiles != null ? totalMiles.toLocaleString() : '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Total fuel (gal)</span><span className={s.metaValue}>{totalGallons != null ? totalGallons.toLocaleString() : '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Net tax due</span><span className={s.metaValue}>{totalNetTax != null ? `$${totalNetTax.toLocaleString()}` : '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Jurisdictions</span><span className={s.metaValue}>{jurisdictions.length}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Created</span><span className={s.metaValue}>{createdAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Last updated</span><span className={s.metaValue}>{updatedAt}</span></div>
            </div>
          </Card>

          {/* Jurisdiction table */}
          <Card noPadding>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionHeader title="Jurisdiction breakdown" subtitle={`${jurisdictions.length} states`} />
            </div>
            {jurisdictions.length === 0 ? (
              <div className={s.emptyState}>No jurisdiction data available yet.</div>
            ) : (
              <div className={s.tableWrap} style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--v3-line)' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>State</th>
                      <th className={`${s.th} ${s.thRight}`}>Miles</th>
                      <th className={`${s.th} ${s.thRight}`}>Taxable gal</th>
                      <th className={`${s.th} ${s.thRight}`}>Rate</th>
                      <th className={`${s.th} ${s.thRight}`}>Tax due</th>
                      <th className={`${s.th} ${s.thRight}`}>Net tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jurisdictions.map(j => (
                      <tr key={j.state}>
                        <td className={s.td}><span style={{ fontWeight: 600 }}>{j.state}</span></td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.miles.toLocaleString()}</td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.taxableGals.toLocaleString()}</td>
                        <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>${j.taxRate.toFixed(4)}</td>
                        <td className={`${s.td} ${s.tdRight}`}>${j.taxDue.toLocaleString()}</td>
                        <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 600 }}>${j.netTax.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Exceptions */}
          {exceptions.length > 0 && (
            <Card>
              <SectionHeader title="Exceptions" subtitle={`${openExceptions.length} open`} />
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>Title</th>
                      <th className={s.th}>Severity</th>
                      <th className={s.th}>State</th>
                      <th className={s.th}>Status</th>
                      <th className={s.th}>Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map(e => (
                      <tr key={e.id}>
                        <td className={s.td} style={{ fontWeight: 500 }}>{e.title}</td>
                        <td className={s.td}><Pill tone={severityTone(e.severity)}>{e.severity}</Pill></td>
                        <td className={s.td}>{e.jurisdiction ?? '—'}</td>
                        <td className={s.td}><Pill tone={e.status === 'RESOLVED' ? 'success' : e.status === 'OPEN' ? 'danger' : 'neutral'}>{e.status}</Pill></td>
                        <td className={`${s.td} ${s.tdMuted}`}>{e.detectedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className={s.sidebar}>
          {/* Notes */}
          <Card>
            <SectionHeader title="Notes" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Internal</div>
                <div style={{ fontSize: 13, color: notesInternal ? 'var(--v3-ink)' : 'var(--v3-muted)', lineHeight: 1.5 }}>
                  {notesInternal || 'No internal notes.'}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--v3-soft-line)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Client visible</div>
                <div style={{ fontSize: 13, color: notesClientVisible ? 'var(--v3-ink)' : 'var(--v3-muted)', lineHeight: 1.5 }}>
                  {notesClientVisible || 'No client-visible notes.'}
                </div>
              </div>
            </div>
          </Card>

          {/* Audit log */}
          <Card>
            <SectionHeader title="Audit log" subtitle={`${auditLog.length} events`} />
            {auditLog.length === 0 ? (
              <div className={s.emptyState}>No events yet.</div>
            ) : (
              <div className={s.logList}>
                {auditLog.map(a => (
                  <div key={a.id} className={s.logItem}>
                    <div className={s.logDot} />
                    <div>
                      <div className={s.logText}>{a.message || a.action}</div>
                      <div className={s.logTime}>{a.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
