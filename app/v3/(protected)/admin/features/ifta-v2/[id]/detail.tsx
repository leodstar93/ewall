'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/filing-detail.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JurRow {
  id: string
  state: string
  miles: number
  taxableGals: number
  taxPaidGals: number
  taxRate: number
  taxDue: number
  taxCredit: number
  netTax: number
}

interface DocRow {
  id: string
  name: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  createdAt: string
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
  fleetMpg: number | null
  notesInternal: string | null
  notesClientVisible: string | null
  createdAt: string
  updatedAt: string
  jurisdictions: JurRow[]
  exceptions: { id: string; severity: string; status: string; title: string; description: string | null; jurisdiction: string | null; detectedAt: string }[]
  auditLog: { id: string; action: string; message: string | null; when: string }[]
  documents: DocRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const IFTA_STEPS = [
  { label: 'Draft',     statuses: ['DRAFT', 'SYNCING'] },
  { label: 'Data\nReady', statuses: ['DATA_READY', 'NEEDS_REVIEW', 'READY_FOR_REVIEW'] },
  { label: 'In\nReview', statuses: ['IN_REVIEW', 'CHANGES_REQUESTED'] },
  { label: 'Approved',  statuses: ['SNAPSHOT_READY', 'PENDING_APPROVAL', 'APPROVED'] },
  { label: 'Finalized', statuses: ['FINALIZED', 'REOPENED', 'ARCHIVED'] },
]

// Staff can edit at any status except these
const NON_EDITABLE = ['APPROVED', 'FINALIZED', 'ARCHIVED']

function severityTone(sev: string): PillTone {
  if (sev === 'ERROR' || sev === 'BLOCKING') return 'danger'
  if (sev === 'WARNING') return 'warn'
  return 'info'
}

function fmtMoney(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtNum(n: number, dec = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const CELL_INPUT: React.CSSProperties = {
  width: 86, padding: '4px 6px', border: '1px solid var(--v3-primary)',
  borderRadius: 5, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
  fontFamily: 'var(--v3-font)', background: 'var(--v3-panel)',
  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
}

// ── Step Tracker ──────────────────────────────────────────────────────────────

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

// ── Draft row type for edit mode ──────────────────────────────────────────────

interface DraftRow {
  miles: string
  taxableGals: string
  taxPaidGals: string
}

// ── Jurisdiction Table (staff edit) ──────────────────────────────────────────

function JurisdictionTable({ filingId, fleetMpg, jurisdictions, canEdit }: {
  filingId: string
  fleetMpg: number | null
  jurisdictions: JurRow[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [mpgDraft, setMpgDraft] = useState('')
  const [rowDraft, setRowDraft] = useState<Record<string, DraftRow>>({})
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function enterEdit() {
    setMpgDraft(fleetMpg ? String(fleetMpg) : '')
    const init: Record<string, DraftRow> = {}
    for (const j of jurisdictions) {
      init[j.state] = {
        miles: String(j.miles),
        taxableGals: String(j.taxableGals),
        taxPaidGals: j.taxPaidGals > 0 ? String(j.taxPaidGals) : '',
      }
    }
    setRowDraft(init)
    setError(null)
    setEditMode(true)
  }

  function cancelEdit() { setEditMode(false); setError(null) }

  function updateRow(state: string, field: keyof DraftRow, val: string) {
    setRowDraft(prev => ({ ...prev, [state]: { ...prev[state], [field]: val } }))
  }

  async function saveEdit() {
    setSaving(true); setError(null)
    const lines = jurisdictions.map(j => {
      const d = rowDraft[j.state] ?? { miles: String(j.miles), taxableGals: String(j.taxableGals), taxPaidGals: '' }
      return {
        jurisdiction: j.state,
        totalMiles: parseFloat(d.miles) || 0,
        taxableGallons: parseFloat(d.taxableGals) || 0,
        taxPaidGallons: parseFloat(d.taxPaidGals) || 0,
      }
    })
    const mpgVal = parseFloat(mpgDraft)
    const body: Record<string, unknown> = { lines }
    if (!isNaN(mpgVal) && mpgVal > 0) body.fleetMpg = mpgVal

    const res = await fetch(`/api/v1/features/ifta-v2/filings/${filingId}/manual-summary`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Save failed'); setSaving(false); return }
    setSaving(false); setEditMode(false); router.refresh()
  }

  async function resetOverride() {
    setResetting(true); setError(null)
    const res = await fetch(`/api/v1/features/ifta-v2/filings/${filingId}/manual-summary`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Reset failed'); setResetting(false); return }
    setResetting(false); router.refresh()
  }

  return (
    <Card noPadding>
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <SectionHeader
          title="Jurisdiction breakdown"
          subtitle={editMode
            ? 'Edit miles, taxable gallons, paid gallons and fleet MPG directly'
            : `${jurisdictions.length} states · Fleet MPG: ${fleetMpg ? fleetMpg.toFixed(4) : '—'}`
          }
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
          {error && <span style={{ fontSize: 11.5, color: 'var(--v3-danger)' }}>{error}</span>}
          {editMode ? (
            <>
              <button onClick={cancelEdit} className={s.btnSecondary} style={{ fontSize: 12 }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} className={s.btnPrimary} style={{ fontSize: 12, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save override'}
              </button>
            </>
          ) : canEdit ? (
            <>
              <button onClick={resetOverride} disabled={resetting} className={s.btnSecondary} style={{ fontSize: 12, opacity: resetting ? 0.7 : 1 }}>
                {resetting ? 'Resetting…' : 'Reset to calculated'}
              </button>
              <button onClick={enterEdit} className={s.btnPrimary} style={{ fontSize: 12 }}>Edit summary</button>
            </>
          ) : null}
        </div>
      </div>

      {/* Fleet MPG row when in edit mode */}
      {editMode && (
        <div style={{ padding: '10px 16px', background: 'var(--v3-primary-soft)', borderTop: '1px solid var(--v3-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v3-primary)', minWidth: 90 }}>Fleet MPG</span>
          <input
            type="number" min={0.01} step="0.01"
            value={mpgDraft}
            onChange={e => setMpgDraft(e.target.value)}
            placeholder="e.g. 6.50"
            style={{ ...CELL_INPUT, width: 110, border: '1px solid var(--v3-primary)' }}
          />
          <span style={{ fontSize: 11.5, color: 'var(--v3-muted)' }}>
            Leave blank to auto-calculate from total miles ÷ total paid gallons
          </span>
        </div>
      )}

      {jurisdictions.length === 0 ? (
        <div className={s.emptyState}>No jurisdiction data available yet.</div>
      ) : (
        <div className={s.tableWrap} style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--v3-line)' }}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.th}>State</th>
                <th className={`${s.th} ${s.thRight}`} style={{ color: editMode ? 'var(--v3-primary)' : undefined }}>Miles</th>
                <th className={`${s.th} ${s.thRight}`} style={{ color: editMode ? 'var(--v3-primary)' : undefined }}>Taxable Gal</th>
                <th className={`${s.th} ${s.thRight}`} style={{ color: editMode ? 'var(--v3-primary)' : undefined }}>Paid Gal</th>
                <th className={`${s.th} ${s.thRight}`}>Rate</th>
                <th className={`${s.th} ${s.thRight}`}>Tax Due</th>
                <th className={`${s.th} ${s.thRight}`}>Credit</th>
                <th className={`${s.th} ${s.thRight}`}>Net Tax</th>
              </tr>
            </thead>
            <tbody>
              {jurisdictions.map(j => {
                const d = rowDraft[j.state]
                return (
                  <tr key={j.id}>
                    <td className={s.td} style={{ fontWeight: 600 }}>{j.state}</td>
                    <td className={`${s.td} ${s.tdRight}`}>
                      {editMode ? (
                        <input type="number" min={0} step="1" value={d?.miles ?? ''} onChange={e => updateRow(j.state, 'miles', e.target.value)} style={CELL_INPUT} />
                      ) : fmtNum(j.miles)}
                    </td>
                    <td className={`${s.td} ${s.tdRight}`}>
                      {editMode ? (
                        <input type="number" min={0} step="0.001" value={d?.taxableGals ?? ''} onChange={e => updateRow(j.state, 'taxableGals', e.target.value)} style={CELL_INPUT} />
                      ) : fmtNum(j.taxableGals, 3)}
                    </td>
                    <td className={`${s.td} ${s.tdRight}`}>
                      {editMode ? (
                        <input type="number" min={0} step="0.001" value={d?.taxPaidGals ?? ''} onChange={e => updateRow(j.state, 'taxPaidGals', e.target.value)} style={CELL_INPUT} placeholder="0" />
                      ) : (
                        <span style={{ color: j.taxPaidGals > 0 ? 'var(--v3-ink)' : 'var(--v3-muted)' }}>
                          {j.taxPaidGals > 0 ? fmtNum(j.taxPaidGals, 3) : '—'}
                        </span>
                      )}
                    </td>
                    <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>${j.taxRate.toFixed(4)}</td>
                    <td className={`${s.td} ${s.tdRight}`}>{fmtMoney(j.taxDue)}</td>
                    <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>{fmtMoney(j.taxCredit)}</td>
                    <td className={`${s.td} ${s.tdRight}`} style={{ fontWeight: 600, color: j.netTax < 0 ? 'var(--v3-success)' : 'var(--v3-ink)' }}>
                      {j.netTax < 0 ? `(${fmtMoney(j.netTax)})` : fmtMoney(j.netTax)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editMode && (
        <div style={{ padding: '10px 16px 14px', fontSize: 12, color: 'var(--v3-muted)', borderTop: '1px solid var(--v3-soft-line)' }}>
          Override persists through recalculations. Use <strong>Reset to calculated</strong> to go back to ELD-derived values.
        </div>
      )}
    </Card>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Upload Modal (general documents) ─────────────────────────────────────────

function UploadModal({ filingId, onClose, onSuccess }: { filingId: string; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!file) return
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/v1/features/ifta-v2/filings/${filingId}/documents`, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Upload failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 420, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Upload document</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <label style={{ display: 'block', border: `2px dashed ${file ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: file ? 'var(--v3-primary-soft)' : 'var(--v3-bg)' }}>
          <input type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file
            ? <><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)' }}>{file.name}</div><div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4 }}>{fmtFileSize(file.size)}</div></>
            : <><div style={{ fontSize: 13, color: 'var(--v3-muted)' }}>Click to select a file</div><div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4 }}>PDF, images, spreadsheets</div></>
          }
        </label>
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={!file || loading} className={s.btnPrimary} style={{ opacity: !file || loading ? 0.7 : 1, cursor: !file || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Finalize Modal (requires payment receipt) ─────────────────────────────────

function FinalizeModal({ filingId, onClose, onSuccess }: { filingId: string; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!file) return
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('paymentReceipt', file)
    const res = await fetch(`/api/v1/features/ifta-v2/filings/${filingId}/finalize`, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed to finalize'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 460, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Finalize filing</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--v3-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Upload the agency payment receipt to complete this filing. The receipt will be saved and visible to the client.
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
          Payment receipt <span style={{ color: 'var(--v3-danger)' }}>*</span>
        </div>
        <label style={{ display: 'block', border: `2px dashed ${file ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: file ? 'var(--v3-primary-soft)' : 'var(--v3-bg)' }}>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file
            ? <><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-primary)' }}>{file.name}</div><div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4 }}>{fmtFileSize(file.size)}</div></>
            : <><div style={{ fontSize: 13, color: 'var(--v3-muted)' }}>Click to select receipt (PDF or image)</div></>
          }
        </label>
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={!file || loading} className={s.btnPrimary} style={{ opacity: !file || loading ? 0.7 : 1, cursor: !file || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Finalizing…' : 'Upload receipt & finalize'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function IftaFilingDetail({
  id, year, quarter, status, statusRaw, tone, tenantName,
  periodStart, periodEnd, totalMiles, totalGallons, totalNetTax, fleetMpg,
  notesInternal, notesClientVisible, createdAt, updatedAt,
  jurisdictions, exceptions, auditLog, documents,
}: Props) {
  const router = useRouter()
  const openExceptions = exceptions.filter(e => e.status === 'OPEN')
  const canEdit = !NON_EDITABLE.includes(statusRaw)

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)

  // Notes edit state
  const [notesInternalDraft, setNotesInternalDraft] = useState(notesInternal ?? '')
  const [notesClientDraft, setNotesClientDraft] = useState(notesClientVisible ?? '')
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  async function saveNotes() {
    setNotesSaving(true); setNotesError(null)
    const res = await fetch(`/api/v1/features/ifta-v2/filings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notesInternal: notesInternalDraft.trim() || null,
        notesClientVisible: notesClientDraft.trim() || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setNotesError((data as { error?: string }).error ?? 'Save failed'); setNotesSaving(false); return }
    setNotesSaving(false); setNotesEditing(false); router.refresh()
  }

  function cancelNotes() {
    setNotesInternalDraft(notesInternal ?? '')
    setNotesClientDraft(notesClientVisible ?? '')
    setNotesEditing(false); setNotesError(null)
  }

  async function doAction(url: string, label: string) {
    setActionLoading(label); setActionError(null)
    const res = await fetch(url, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setActionError((data as { error?: string }).error ?? 'Failed'); setActionLoading(null); return }
    setActionLoading(null); router.refresh()
  }

  // "Finalize" is handled by FinalizeModal — excluded from doAction list
  const actions: { label: string; type: 'primary' | 'secondary' | 'danger'; url: string }[] = (() => {
    const base = `/api/v1/features/ifta-v2/filings/${id}`
    switch (statusRaw) {
      case 'DATA_READY': case 'NEEDS_REVIEW': return [
        { label: 'Start review', type: 'primary', url: `${base}/start-review` },
        { label: 'Request changes', type: 'secondary', url: `${base}/request-changes` },
      ]
      case 'READY_FOR_REVIEW': return [{ label: 'Begin review', type: 'primary', url: `${base}/claim` }]
      case 'IN_REVIEW': return [
        { label: 'Create snapshot', type: 'primary', url: `${base}/create-snapshot` },
        { label: 'Request changes', type: 'secondary', url: `${base}/request-changes` },
      ]
      case 'SNAPSHOT_READY': return [
        { label: 'Approve', type: 'primary', url: `${base}/approve` },
      ]
      case 'PENDING_APPROVAL': return []
      case 'FINALIZED': return [{ label: 'Reopen', type: 'secondary', url: `${base}/reopen` }]
      default: return []
    }
  })()

  return (
    <div className={s.wrapper}>
      {uploadOpen && <UploadModal filingId={id} onClose={() => setUploadOpen(false)} onSuccess={() => { setUploadOpen(false); router.refresh() }} />}
      {finalizeOpen && <FinalizeModal filingId={id} onClose={() => setFinalizeOpen(false)} onSuccess={() => { setFinalizeOpen(false); router.refresh() }} />}

      {/* Header */}
      <div className={s.header}>
        <Link href="/v3/admin/features/ifta-v2" className={s.backBtn}>
          <V3Icon name="chevLeft" size={13} /> IFTA filings
        </Link>
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <h1 className={s.title}>IFTA · {year} Q{quarter}</h1>
            <Pill tone={tone}>{status}</Pill>
            {openExceptions.length > 0 && <Pill tone="danger">{openExceptions.length} exception{openExceptions.length !== 1 ? 's' : ''}</Pill>}
          </div>
          <div className={s.sub}>{tenantName} · {periodStart} – {periodEnd}</div>
        </div>
        <div className={s.headerActions}>
          {actionError && <span style={{ fontSize: 12, color: 'var(--v3-danger)' }}>{actionError}</span>}
          {statusRaw === 'PENDING_APPROVAL' && (
            <span style={{ fontSize: 12, color: 'var(--v3-warn)', background: 'var(--v3-warn-bg)', padding: '5px 10px', borderRadius: 20 }}>
              Waiting for client approval
            </span>
          )}
          <button onClick={() => setUploadOpen(true)} className={s.btnSecondary}>Upload document</button>
          {actions.map(a => (
            <button
              key={a.label}
              onClick={() => doAction(a.url, a.label)}
              disabled={actionLoading !== null}
              className={s[`btn${a.type.charAt(0).toUpperCase() + a.type.slice(1)}` as 'btnPrimary' | 'btnSecondary' | 'btnDanger']}
              style={{ opacity: actionLoading !== null ? 0.7 : 1, cursor: actionLoading !== null ? 'not-allowed' : 'pointer' }}
            >
              {actionLoading === a.label ? `${a.label}…` : a.label}
            </button>
          ))}
          {statusRaw === 'APPROVED' && (
            <button onClick={() => setFinalizeOpen(true)} className={s.btnPrimary}>Finalize</button>
          )}
        </div>
      </div>

      {/* Step tracker */}
      <StepTracker statusRaw={statusRaw} />

      {/* Body */}
      <div className={s.body}>
        <div className={s.main}>

          {/* Filing info */}
          <Card>
            <SectionHeader title="Filing details" />
            <div className={s.metaGrid}>
              <div className={s.metaItem}><span className={s.metaLabel}>Tenant</span><span className={s.metaValue}>{tenantName}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Period</span><span className={s.metaValue}>{periodStart} – {periodEnd}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Total miles</span><span className={s.metaValue}>{totalMiles != null ? fmtNum(totalMiles) : '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Total fuel (gal)</span><span className={s.metaValue}>{totalGallons != null ? fmtNum(totalGallons, 3) : '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Fleet MPG</span><span className={s.metaValue}>{fleetMpg != null ? fleetMpg.toFixed(4) : '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Net tax due</span><span className={s.metaValue}>{totalNetTax != null ? fmtMoney(totalNetTax) : '—'}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Jurisdictions</span><span className={s.metaValue}>{jurisdictions.length}</span></div>
              <div className={s.metaItem}><span className={s.metaLabel}>Created</span><span className={s.metaValue}>{createdAt}</span></div>
            </div>
          </Card>

          {/* Jurisdiction table — full staff edit */}
          <JurisdictionTable
            filingId={id}
            fleetMpg={fleetMpg}
            jurisdictions={jurisdictions}
            canEdit={canEdit}
          />

          {/* Documents */}
          <Card noPadding>
            <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Documents" subtitle={`${documents.length} file${documents.length !== 1 ? 's' : ''}`} />
              <button onClick={() => setUploadOpen(true)} className={s.btnSecondary} style={{ fontSize: 12 }}>+ Upload</button>
            </div>
            {documents.length === 0 ? (
              <div className={s.emptyState}>No documents uploaded yet.</div>
            ) : (
              <div className={s.tableWrap} style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--v3-line)' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th className={s.th}>File</th>
                      <th className={`${s.th} ${s.thRight}`}>Size</th>
                      <th className={s.th}>Uploaded</th>
                      <th className={s.th} style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(d => (
                      <tr key={d.id}>
                        <td className={s.td}>
                          <div style={{ fontWeight: 500 }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{d.fileName}</div>
                        </td>
                        <td className={`${s.td} ${s.tdRight} ${s.tdMuted}`}>{fmtFileSize(d.fileSize)}</td>
                        <td className={`${s.td} ${s.tdMuted}`}>{d.createdAt}</td>
                        <td className={s.td}>
                          <a
                            href={d.fileUrl}
                            download={d.fileName}
                            style={{ display: 'inline-block', padding: '4px 10px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 6, fontSize: 11.5, color: 'var(--v3-ink)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            Download
                          </a>
                        </td>
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
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <SectionHeader title="Notes" />
              {notesEditing ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {notesError && <span style={{ fontSize: 11.5, color: 'var(--v3-danger)' }}>{notesError}</span>}
                  <button onClick={cancelNotes} className={s.btnSecondary} style={{ fontSize: 12 }}>Cancel</button>
                  <button onClick={saveNotes} disabled={notesSaving} className={s.btnPrimary} style={{ fontSize: 12, opacity: notesSaving ? 0.7 : 1, cursor: notesSaving ? 'not-allowed' : 'pointer' }}>
                    {notesSaving ? 'Saving…' : 'Save notes'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setNotesEditing(true)} className={s.btnSecondary} style={{ fontSize: 12 }}>Edit</button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Internal</div>
                {notesEditing ? (
                  <textarea
                    value={notesInternalDraft}
                    onChange={e => setNotesInternalDraft(e.target.value)}
                    placeholder="Internal staff notes (not visible to client)…"
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: notesInternal ? 'var(--v3-ink)' : 'var(--v3-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {notesInternal || 'No internal notes.'}
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--v3-soft-line)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Client visible</div>
                {notesEditing ? (
                  <textarea
                    value={notesClientDraft}
                    onChange={e => setNotesClientDraft(e.target.value)}
                    placeholder="Message shown to the client on their filing detail page…"
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: notesClientVisible ? 'var(--v3-ink)' : 'var(--v3-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {notesClientVisible || 'No client-visible notes.'}
                  </div>
                )}
              </div>
            </div>
          </Card>

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
