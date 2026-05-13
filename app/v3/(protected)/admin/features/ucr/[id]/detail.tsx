'use client'

import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/filing-detail.module.css'

const UCR_STEPS = [
  { label: 'Draft',      statuses: ['DRAFT'] },
  { label: 'Payment',    statuses: ['AWAITING_CUSTOMER_PAYMENT', 'CUSTOMER_PAYMENT_PENDING', 'CUSTOMER_PAID'] },
  { label: 'Processing', statuses: ['QUEUED_FOR_PROCESSING', 'IN_PROCESS', 'OFFICIAL_PAYMENT_PENDING', 'OFFICIAL_PAID'] },
  { label: 'Review',     statuses: ['SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUESTED', 'RESUBMITTED', 'PENDING_PROOF', 'NEEDS_ATTENTION'] },
  { label: 'Approved',   statuses: ['APPROVED', 'COMPLIANT', 'COMPLETED', 'REJECTED', 'CANCELLED'] },
]

function StepTracker({ statusRaw }: { statusRaw: string }) {
  const currentIdx = UCR_STEPS.findIndex(st => st.statuses.includes(statusRaw))
  return (
    <Card>
      <div className={s.steps}>
        {UCR_STEPS.map((st, i) => {
          const done = i < currentIdx
          const current = i === currentIdx
          return (
            <div key={st.label} className={s.step} data-done={done} data-current={current}>
              <div className={s.stepDot}>{done ? '✓' : i + 1}</div>
              <div className={s.stepLabel}>{st.label}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

interface Props {
  id: string
  year: number
  filingYear: number
  status: string
  statusRaw: string
  tone: PillTone
  companyName: string
  dotNumber: string | null
  mcNumber: string | null
  entityType: string
  vehicleCount: number
  bracketLabel: string
  feeAmount: number
  serviceFee: number
  processingFee: number
  totalCharged: number
  customerPaid: number
  balanceDue: number
  receiptNumber: string | null
  staffNotes: string | null
  internalNotes: string | null
  correctionNote: string | null
  createdAt: string
  updatedAt: string
  customerPaidAt: string
  completedAt: string
  docCount: number
  events: { id: string; type: string; message: string | null; when: string }[]
}

export function UCRFilingDetail({ year, filingYear, status, statusRaw, tone, companyName, dotNumber, mcNumber, entityType, vehicleCount, bracketLabel, feeAmount, serviceFee, processingFee, totalCharged, customerPaid, balanceDue, receiptNumber, staffNotes, internalNotes, correctionNote, createdAt, updatedAt, customerPaidAt, completedAt, docCount, events }: Props) {
  const actions: { label: string; type: 'primary' | 'secondary' | 'danger' }[] = (() => {
    switch (statusRaw) {
      case 'AWAITING_CUSTOMER_PAYMENT': return [{ label: 'Mark customer paid', type: 'primary' }]
      case 'CUSTOMER_PAID': return [{ label: 'Queue for processing', type: 'primary' }]
      case 'IN_PROCESS': case 'OFFICIAL_PAYMENT_PENDING': return [{ label: 'Mark official paid', type: 'primary' }]
      case 'UNDER_REVIEW': return [{ label: 'Approve', type: 'primary' }, { label: 'Request correction', type: 'secondary' }]
      case 'RESUBMITTED': return [{ label: 'Mark compliant', type: 'primary' }]
      default: return []
    }
  })()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Link href="/v3/admin/features/ucr" className={s.backBtn}>
          <V3Icon name="chevLeft" size={13} /> UCR filings
        </Link>
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <h1 className={s.title}>UCR · {filingYear}</h1>
            <Pill tone={tone}>{status}</Pill>
          </div>
          <div className={s.sub}>{companyName} · Year {year}</div>
        </div>
        <div className={s.headerActions}>
          {actions.map(a => (
            <button key={a.label} className={s[`btn${a.type.charAt(0).toUpperCase() + a.type.slice(1)}` as 'btnPrimary' | 'btnSecondary' | 'btnDanger']} type="button">
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <StepTracker statusRaw={statusRaw} />

      <div className={s.body}>
        <div className={s.main}>
          {/* Filing info */}
          <Card>
            <SectionHeader title="Filing details" />
            <div className={s.metaGrid}>
              <div className={s.metaItem}><span className={s.metaLabel}>Company</span><span className={s.metaValue}>{companyName}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Entity type</span><span className={s.metaValue}>{entityType}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>DOT number</span><span className={s.metaValue}>{dotNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>MC number</span><span className={s.metaValue}>{mcNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Vehicle count</span><span className={s.metaValue}>{vehicleCount}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Bracket</span><span className={s.metaValue}>{bracketLabel}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Receipt no.</span><span className={s.metaValue}>{receiptNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Documents</span><span className={s.metaValue}>{docCount}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Customer paid</span><span className={s.metaValue}>{customerPaidAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Completed</span><span className={s.metaValue}>{completedAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Created</span><span className={s.metaValue}>{createdAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Last updated</span><span className={s.metaValue}>{updatedAt}</span></div>
            </div>
          </Card>

          {/* Payment breakdown */}
          <Card>
            <SectionHeader title="Payment breakdown" />
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th className={s.th}>Item</th>
                    <th className={`${s.th} ${s.thRight}`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'UCR fee',         amount: feeAmount },
                    { label: 'Service fee',     amount: serviceFee },
                    { label: 'Processing fee',  amount: processingFee },
                    { label: 'Total charged',   amount: totalCharged },
                    { label: 'Customer paid',   amount: customerPaid },
                    { label: 'Balance due',     amount: balanceDue },
                  ].map(r => (
                    <tr key={r.label}>
                      <td className={s.td} style={{ fontWeight: r.label === 'Total charged' || r.label === 'Balance due' ? 600 : 400 }}>{r.label}</td>
                      <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: r.label === 'Total charged' || r.label === 'Balance due' ? 600 : 400, color: r.label === 'Balance due' && r.amount > 0 ? 'var(--v3-danger)' : 'var(--v3-ink)' }}>
                        ${r.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className={s.sidebar}>
          {/* Notes */}
          <Card>
            <SectionHeader title="Notes" />
            {[
              { label: 'Staff notes', val: staffNotes },
              { label: 'Internal',    val: internalNotes },
              { label: 'Correction',  val: correctionNote },
            ].map((n, i) => (
              <div key={n.label} style={{ borderTop: i > 0 ? '1px solid var(--v3-soft-line)' : 'none', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{n.label}</div>
                <div style={{ fontSize: 13, color: n.val ? 'var(--v3-ink)' : 'var(--v3-muted)', lineHeight: 1.5 }}>{n.val || 'None.'}</div>
              </div>
            ))}
          </Card>

          {/* Event log */}
          <Card>
            <SectionHeader title="Event log" subtitle={`${events.length} events`} />
            {events.length === 0 ? (
              <div className={s.emptyState}>No events yet.</div>
            ) : (
              <div className={s.logList}>
                {events.map(e => (
                  <div key={e.id} className={s.logItem}>
                    <div className={s.logDot} />
                    <div>
                      <div className={s.logText}>{e.message || e.type}</div>
                      <div className={s.logTime}>{e.when}</div>
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
