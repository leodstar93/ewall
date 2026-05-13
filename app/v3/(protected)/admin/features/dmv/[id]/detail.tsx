'use client'

import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/filing-detail.module.css'

const DMV_STEPS = [
  { label: 'Draft',      statuses: ['DRAFT'] },
  { label: 'Pending',    statuses: ['PENDING'] },
  { label: 'In Review',  statuses: ['IN_REVIEW'] },
  { label: 'Active',     statuses: ['APPROVED', 'ACTIVE'] },
]

function StepTracker({ statusRaw }: { statusRaw: string }) {
  const isTerminal = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(statusRaw)
  const currentIdx = isTerminal ? -1 : DMV_STEPS.findIndex(st => st.statuses.includes(statusRaw))
  return (
    <Card>
      <div className={s.steps}>
        {DMV_STEPS.map((st, i) => {
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

interface RenewalRow {
  id: string
  year: number
  status: string
  tone: PillTone
  dueDate: string
  completedAt: string
}

interface Props {
  id: string
  status: string
  statusRaw: string
  tone: PillTone
  registrationType: string
  filingType: string
  truckUnit: string
  truckVin: string
  truckMakeModel: string
  plateNumber: string | null
  baseJurisdiction: string | null
  dotNumber: string | null
  mcNumber: string | null
  declaredGVW: string
  apportioned: boolean
  fleetNumber: string | null
  cabCardNumber: string | null
  effectiveDate: string
  expirationDate: string
  daysLeft: number | null
  approvedAt: string
  createdAt: string
  updatedAt: string
  ownerName: string | null
  ownerEmail: string | null
  jurisdictions: { code: string; declaredWeight: number | null; estimatedMiles: number | null; actualMiles: number | null }[]
  renewals: RenewalRow[]
  activities: { id: string; action: string; message: string | null; actor: string; when: string }[]
}

export function DmvRegistrationDetail({ status, statusRaw, tone, registrationType, filingType, truckUnit, truckVin, truckMakeModel, plateNumber, baseJurisdiction, dotNumber, mcNumber, declaredGVW, apportioned, fleetNumber, cabCardNumber, effectiveDate, expirationDate, daysLeft, approvedAt, createdAt, updatedAt, ownerName, ownerEmail, jurisdictions, renewals, activities }: Props) {
  const expiring = daysLeft != null && daysLeft >= 0 && daysLeft <= 60
  const expired  = daysLeft != null && daysLeft < 0

  const actions: { label: string; type: 'primary' | 'secondary' | 'danger' }[] = (() => {
    switch (statusRaw) {
      case 'DRAFT':    return [{ label: 'Submit for review', type: 'primary' }]
      case 'PENDING':  return [{ label: 'Begin review', type: 'primary' }]
      case 'IN_REVIEW': return [{ label: 'Approve', type: 'primary' }, { label: 'Reject', type: 'danger' }]
      case 'ACTIVE': case 'APPROVED':
        return expiring || expired ? [{ label: 'Start renewal', type: 'primary' }] : []
      default: return []
    }
  })()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Link href="/v3/admin/features/dmv" className={s.backBtn}>
          <V3Icon name="chevLeft" size={13} /> DMV renewals
        </Link>
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <h1 className={s.title}>DMV · Unit {truckUnit}</h1>
            <Pill tone={tone}>{status}</Pill>
            {expired && <Pill tone="danger">Expired</Pill>}
            {expiring && !expired && <Pill tone="warn">{daysLeft}d left</Pill>}
          </div>
          <div className={s.sub}>{registrationType} · {filingType} · {truckMakeModel}</div>
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
          {/* Registration info */}
          <Card>
            <SectionHeader title="Registration details" />
            <div className={s.metaGrid}>
              <div className={s.metaItem}><span className={s.metaLabel}>Unit</span><span className={s.metaValue}>{truckUnit}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>VIN</span><span className={s.metaValue} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{truckVin}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Plate</span><span className={s.metaValue}>{plateNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Base state</span><span className={s.metaValue}>{baseJurisdiction ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>DOT</span><span className={s.metaValue}>{dotNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>MC</span><span className={s.metaValue}>{mcNumber ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Declared GVW</span><span className={s.metaValue}>{declaredGVW}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Apportioned</span><span className={s.metaValue}>{apportioned ? 'Yes' : 'No'}</span></div>
              {fleetNumber && <div className={s.metaItem}><span className={s.metaLabel}>Fleet no.</span><span className={s.metaValue}>{fleetNumber}</span></div>}
              {cabCardNumber && <div className={s.metaItem}><span className={s.metaLabel}>Cab card</span><span className={s.metaValue}>{cabCardNumber}</span></div>}
              <div className={s.metaItem}><span className={s.metaLabel}>Effective</span><span className={s.metaValue}>{effectiveDate}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Expires</span><span className={s.metaValue} style={{ color: expired ? 'var(--v3-danger)' : expiring ? 'var(--v3-warn)' : 'var(--v3-ink)' }}>{expirationDate}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Approved</span><span className={s.metaValue}>{approvedAt}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Created</span><span className={s.metaValue}>{createdAt}</span></div>
            </div>
          </Card>

          {/* Jurisdictions */}
          {jurisdictions.length > 0 && (
            <Card noPadding>
              <div style={{ padding: '14px 16px 0' }}>
                <SectionHeader title="Jurisdictions" subtitle={`${jurisdictions.length} states`} />
              </div>
              <div className={s.tableWrap} style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--v3-line)' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>State</th>
                      <th className={`${s.th} ${s.thRight}`}>Declared weight</th>
                      <th className={`${s.th} ${s.thRight}`}>Est. miles</th>
                      <th className={`${s.th} ${s.thRight}`}>Actual miles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jurisdictions.map(j => (
                      <tr key={j.code}>
                        <td className={s.td} style={{ fontWeight: 600 }}>{j.code}</td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.declaredWeight ? `${j.declaredWeight.toLocaleString()} lbs` : '—'}</td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.estimatedMiles ? j.estimatedMiles.toLocaleString() : '—'}</td>
                        <td className={`${s.td} ${s.tdRight}`}>{j.actualMiles ? j.actualMiles.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Renewals */}
          {renewals.length > 0 && (
            <Card>
              <SectionHeader title="Renewal history" subtitle={`${renewals.length} cycles`} />
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>Year</th>
                      <th className={s.th}>Status</th>
                      <th className={s.th}>Due date</th>
                      <th className={s.th}>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renewals.map(r => (
                      <tr key={r.id}>
                        <td className={s.td} style={{ fontWeight: 600 }}>{r.year}</td>
                        <td className={s.td}><Pill tone={r.tone}>{r.status}</Pill></td>
                        <td className={`${s.td} ${s.tdMuted}`}>{r.dueDate}</td>
                        <td className={`${s.td} ${s.tdMuted}`}>{r.completedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className={s.sidebar}>
          {/* Owner */}
          <Card>
            <SectionHeader title="Owner" />
            <div className={s.metaGrid} style={{ gridTemplateColumns: '1fr' }}>
              <div className={s.metaItem}><span className={s.metaLabel}>Name</span><span className={s.metaValue}>{ownerName ?? '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Email</span><span className={s.metaValue} style={{ fontSize: 12.5 }}>{ownerEmail ?? '—'}</span></div>
            </div>
          </Card>

          {/* Activity log */}
          <Card>
            <SectionHeader title="Activity log" subtitle={`${activities.length} events`} />
            {activities.length === 0 ? (
              <div className={s.emptyState}>No activity yet.</div>
            ) : (
              <div className={s.logList}>
                {activities.map(a => (
                  <div key={a.id} className={s.logItem}>
                    <div className={s.logDot} />
                    <div>
                      <div className={s.logText}>{a.message || a.action}</div>
                      <div className={s.logTime}>{a.actor} · {a.when}</div>
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
