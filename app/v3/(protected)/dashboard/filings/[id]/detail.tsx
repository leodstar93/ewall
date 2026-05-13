'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import styles from '@/app/v3/components/ui/filing-detail.module.css'
import type { IftaFilingStatus } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JurisdictionRow {
  id: string
  jurisdiction: string
  totalMiles: number
  taxableGallons: number
  taxPaidGallons: number
  taxRate: number
  taxDue: number
  taxCredit: number
  netTax: number
}

interface AuditRow {
  id: string
  action: string
  message: string | null
  createdAt: string
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

interface AuthorizationInfo {
  status: string
  signerName: string | null
  signerTitle: string | null
  signedAt: string | null
}

interface FilingProps {
  id: string
  year: number
  quarter: number
  status: IftaFilingStatus
  periodStart: string | null
  periodEnd: string | null
  totalDistance: number | null
  totalFuelGallons: number | null
  totalNetTax: number | null
  totalTaxDue: number | null
  fleetMpg: number | null
  notesClientVisible: string | null
  updatedAt: string
  authorization: AuthorizationInfo | null
  jurisdictions: JurisdictionRow[]
  audits: AuditRow[]
}

interface Props {
  filing: FilingProps
  documents: DocRow[]
  disclosureText: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EDITABLE_STATUSES: IftaFilingStatus[] = [
  'DRAFT', 'DATA_READY', 'NEEDS_REVIEW', 'CHANGES_REQUESTED',
]

const STATUS_STEPS: IftaFilingStatus[] = [
  'DRAFT', 'DATA_READY', 'READY_FOR_REVIEW', 'IN_REVIEW',
  'SNAPSHOT_READY', 'PENDING_APPROVAL', 'FINALIZED',
]

const STEP_LABELS: Partial<Record<IftaFilingStatus, string>> = {
  DRAFT: 'Draft', DATA_READY: 'Data Ready', READY_FOR_REVIEW: 'Submitted',
  IN_REVIEW: 'In Review', SNAPSHOT_READY: 'Snapshot', PENDING_APPROVAL: 'Approval', FINALIZED: 'Finalized',
}

function statusTone(s: IftaFilingStatus): PillTone {
  if (['APPROVED', 'FINALIZED'].includes(s)) return 'success'
  if (['CHANGES_REQUESTED'].includes(s)) return 'danger'
  if (['IN_REVIEW', 'SNAPSHOT_READY', 'PENDING_APPROVAL'].includes(s)) return 'warn'
  if (['DATA_READY', 'NEEDS_REVIEW', 'READY_FOR_REVIEW', 'SYNCING'].includes(s)) return 'info'
  return 'neutral'
}

function statusLabel(s: IftaFilingStatus): string {
  const m: Partial<Record<IftaFilingStatus, string>> = {
    DRAFT: 'Draft', SYNCING: 'Syncing', DATA_READY: 'Data Ready',
    NEEDS_REVIEW: 'Needs Review', READY_FOR_REVIEW: 'Ready for Review',
    IN_REVIEW: 'In Review', CHANGES_REQUESTED: 'Changes Requested',
    SNAPSHOT_READY: 'Snapshot Ready', PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved', FINALIZED: 'Finalized', REOPENED: 'Reopened', ARCHIVED: 'Archived',
  }
  return m[s] ?? s
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtNum(n: number | null, decimals = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return fmtDate(iso)
}

function auditLabel(action: string, message: string | null): string {
  if (message) return message
  const m: Record<string, string> = {
    'filing.created': 'Filing created',
    'filing.submitted': 'Submitted for review',
    'filing.client_approved': 'Client approved',
    'filing.client_rejected_approval': 'Client requested changes',
    'filing.data_ready': 'Data synced and ready',
    'filing.in_review': 'Staff started review',
    'filing.snapshot_created': 'Snapshot generated',
    'filing.pending_approval': 'Sent for approval',
    'filing.finalized': 'Filing finalized',
    'filing.document_uploaded': 'Document uploaded',
    'filing.manual_fuel.replace': 'Fuel data updated',
    'filing.chat_message': 'Message added',
  }
  return m[action] ?? action.replace(/filing\.|_/g, ' ').trim()
}

// ── Inline cell input style ───────────────────────────────────────────────────

const CELL_INPUT: React.CSSProperties = {
  width: 90, padding: '4px 6px', border: '1px solid var(--v3-primary)',
  borderRadius: 5, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
  fontFamily: 'var(--v3-font)', background: 'var(--v3-panel)',
  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
}

// ── Step Tracker ──────────────────────────────────────────────────────────────

function StepTracker({ status }: { status: IftaFilingStatus }) {
  const currentIdx = STATUS_STEPS.indexOf(status)
  const effectiveIdx = currentIdx === -1 ? 0 : currentIdx
  return (
    <Card>
      <div className={styles.steps}>
        {STATUS_STEPS.map((step, i) => {
          const done = i < effectiveIdx
          const current = i === effectiveIdx
          return (
            <div key={step} className={styles.step} data-done={done} data-current={current}>
              <div className={styles.stepDot}>{done ? '✓' : i + 1}</div>
              <div className={styles.stepLabel}>{STEP_LABELS[step]}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ filingId, onClose, onSuccess }: { filingId: string; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        <div
          onClick={() => inputRef.current?.click()}
          style={{ border: `2px dashed ${file ? 'var(--v3-primary)' : 'var(--v3-line)'}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: file ? 'var(--v3-primary-soft)' : 'var(--v3-bg)' }}
        >
          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v3-ink)' }}>{file.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4 }}>{fmtFileSize(file.size)}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: 'var(--v3-muted)' }}>Click to select a file</div>
              <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 4 }}>PDF, images, or spreadsheets</div>
            </div>
          )}
        </div>
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className={styles.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={!file || loading} className={styles.btnPrimary} style={{ opacity: !file || loading ? 0.7 : 1, cursor: !file || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Disclosure Modal ──────────────────────────────────────────────────────────

function DisclosureModal({
  filingId,
  disclosureText,
  onClose,
  onSuccess,
}: {
  filingId: string
  disclosureText: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultDisclosure =
    'By signing below, I certify that the information provided in this IFTA filing is true, accurate, and complete to the best of my knowledge. I understand that providing false information may result in penalties.'

  async function submit() {
    if (!name.trim()) { setError('Please enter your name.'); return }
    setLoading(true); setError(null)

    const authRes = await fetch(`/api/v1/features/ifta-v2/filings/${filingId}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName: name.trim(), signerTitle: title.trim() || undefined }),
    })
    const authData = await authRes.json().catch(() => ({}))
    if (!authRes.ok) { setError((authData as { error?: string }).error ?? 'Authorization failed'); setLoading(false); return }

    const submitRes = await fetch(`/api/v1/features/ifta-v2/filings/${filingId}/submit`, { method: 'POST' })
    const submitData = await submitRes.json().catch(() => ({}))
    if (!submitRes.ok) { setError((submitData as { error?: string }).error ?? 'Submit failed'); setLoading(false); return }

    setLoading(false)
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 520, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Sign &amp; submit filing</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginBottom: 18, lineHeight: 1.5 }}>
          You must sign the disclosure below before submitting this filing for review.
        </div>

        {/* Disclosure text */}
        <div style={{ background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Disclosure</div>
          <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.7 }}>
            {disclosureText ?? defaultDisclosure}
          </div>
        </div>

        {/* Signer fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', marginBottom: 5 }}>Full name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your legal name"
              style={{ width: '100%', padding: '8px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', fontFamily: 'var(--v3-font)', background: 'var(--v3-panel)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', marginBottom: 5 }}>Title / Role</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Owner, Fleet Manager"
              style={{ width: '100%', padding: '8px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', fontFamily: 'var(--v3-font)', background: 'var(--v3-panel)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className={styles.btnSecondary}>Cancel</button>
          <button
            onClick={submit}
            disabled={loading || !name.trim()}
            className={styles.btnPrimary}
            style={{ opacity: loading || !name.trim() ? 0.7 : 1, cursor: loading || !name.trim() ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Submitting…' : 'Sign & submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ filingId, onClose, onSuccess }: { filingId: string; onClose: () => void; onSuccess: () => void }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true); setError(null)
    const res = await fetch(`/api/v1/features/ifta-v2/filings/${filingId}/client-reject-approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed'); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 420, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Request changes</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--v3-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Describe what needs to be corrected. Our team will review and update the filing.
        </div>
        <textarea
          value={note} onChange={e => setNote(e.target.value)} placeholder="Describe the issue…" rows={4}
          style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} className={styles.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={loading} className={styles.btnDanger} style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Sending…' : 'Request changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Jurisdiction Table with editable paid gallons ─────────────────────────────

function JurisdictionTable({ filing, canEdit }: { filing: FilingProps; canEdit: boolean }) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  // draft: jurisdiction → paid gallons string (user input)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function enterEdit() {
    const initial: Record<string, string> = {}
    for (const j of filing.jurisdictions) {
      initial[j.jurisdiction] = j.taxPaidGallons > 0 ? String(j.taxPaidGallons) : ''
    }
    setDraft(initial)
    setSaveError(null)
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setSaveError(null)
  }

  async function saveEdit() {
    setSaving(true); setSaveError(null)
    const lines = Object.entries(draft)
      .map(([jurisdiction, val]) => ({ jurisdiction, gallons: parseFloat(val) || 0 }))
      .filter(l => l.gallons > 0)

    const res = await fetch(`/api/v1/features/ifta-v2/filings/${filing.id}/manual-fuel`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setSaveError((data as { error?: string }).error ?? 'Save failed'); setSaving(false); return }
    setSaving(false)
    setEditMode(false)
    router.refresh()
  }

  const { jurisdictions } = filing

  return (
    <Card noPadding>
      <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader
          title="Jurisdiction breakdown"
          subtitle={editMode
            ? 'Enter paid gallons per state — taxable gallons recalculate on save'
            : `${jurisdictions.length} states · Fleet MPG: ${filing.fleetMpg ? filing.fleetMpg.toFixed(2) : '—'}`
          }
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveError && <span style={{ fontSize: 12, color: 'var(--v3-danger)' }}>{saveError}</span>}
          {editMode ? (
            <>
              <button onClick={cancelEdit} className={styles.btnSecondary} style={{ fontSize: 12 }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} className={styles.btnPrimary} style={{ fontSize: 12, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save fuel data'}
              </button>
            </>
          ) : canEdit && jurisdictions.length > 0 ? (
            <button onClick={enterEdit} className={styles.btnSecondary} style={{ fontSize: 12 }}>Edit fuel data</button>
          ) : null}
        </div>
      </div>

      {jurisdictions.length === 0 ? (
        <div className={styles.emptyState}>No jurisdiction data yet.</div>
      ) : (
        <div className={styles.tableWrap} style={{ border: 'none', borderRadius: 0 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>State</th>
                <th className={`${styles.th} ${styles.thRight}`}>Miles</th>
                <th className={`${styles.th} ${styles.thRight}`}>Taxable Gal</th>
                <th className={`${styles.th} ${styles.thRight}`} style={{ color: editMode ? 'var(--v3-primary)' : undefined }}>
                  {editMode ? '✏ Paid Gal' : 'Paid Gal'}
                </th>
                <th className={`${styles.th} ${styles.thRight}`}>Rate</th>
                <th className={`${styles.th} ${styles.thRight}`}>Tax Due</th>
                <th className={`${styles.th} ${styles.thRight}`}>Credit</th>
                <th className={`${styles.th} ${styles.thRight}`}>Net Tax</th>
              </tr>
            </thead>
            <tbody>
              {jurisdictions.map(j => (
                <tr key={j.id}>
                  <td className={styles.td} style={{ fontWeight: 600 }}>{j.jurisdiction}</td>
                  <td className={`${styles.td} ${styles.tdRight}`}>{fmtNum(j.totalMiles)}</td>
                  <td className={`${styles.td} ${styles.tdRight}`}>{fmtNum(j.taxableGallons, 3)}</td>
                  <td className={`${styles.td} ${styles.tdRight}`}>
                    {editMode ? (
                      <input
                        type="number" min={0} step="0.001"
                        value={draft[j.jurisdiction] ?? ''}
                        onChange={e => setDraft(prev => ({ ...prev, [j.jurisdiction]: e.target.value }))}
                        style={CELL_INPUT}
                        placeholder="0"
                      />
                    ) : (
                      <span style={{ color: j.taxPaidGallons > 0 ? 'var(--v3-ink)' : 'var(--v3-muted)' }}>
                        {j.taxPaidGallons > 0 ? fmtNum(j.taxPaidGallons, 3) : '—'}
                      </span>
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.tdRight} ${styles.tdMuted}`}>{(j.taxRate * 100).toFixed(3)}¢</td>
                  <td className={`${styles.td} ${styles.tdRight}`}>{fmtMoney(j.taxDue)}</td>
                  <td className={`${styles.td} ${styles.tdRight} ${styles.tdMuted}`}>{fmtMoney(j.taxCredit)}</td>
                  <td className={`${styles.td} ${styles.tdRight}`} style={{ fontWeight: 600, color: j.netTax < 0 ? 'var(--v3-success)' : 'var(--v3-ink)' }}>
                    {j.netTax < 0 ? `(${fmtMoney(j.netTax)})` : fmtMoney(j.netTax)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editMode && (
        <div style={{ padding: '10px 18px 14px', fontSize: 12, color: 'var(--v3-muted)', borderTop: '1px solid var(--v3-soft-line)' }}>
          Taxable gallons and net tax recalculate automatically after saving based on your fleet MPG.
        </div>
      )}
    </Card>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function IftaFilingDetail({ filing, documents: initialDocs, disclosureText }: Props) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const canEdit = EDITABLE_STATUSES.includes(filing.status)
  const canSubmit = canEdit
  const canApprove = filing.status === 'PENDING_APPROVAL'
  const isSigned = filing.authorization?.status === 'SIGNED'

  async function doAction(url: string) {
    setActionLoading(true); setActionError(null)
    const res = await fetch(url, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setActionError((data as { error?: string }).error ?? 'Action failed'); setActionLoading(false); return }
    setActionLoading(false)
    router.refresh()
  }

  return (
    <div className={styles.wrapper}>
      {uploading && <UploadModal filingId={filing.id} onClose={() => setUploading(false)} onSuccess={() => { setUploading(false); router.refresh() }} />}
      {rejecting && <RejectModal filingId={filing.id} onClose={() => setRejecting(false)} onSuccess={() => { setRejecting(false); router.refresh() }} />}
      {disclosureOpen && (
        <DisclosureModal
          filingId={filing.id}
          disclosureText={disclosureText}
          onClose={() => setDisclosureOpen(false)}
          onSuccess={() => { setDisclosureOpen(false); router.refresh() }}
        />
      )}

      {/* Header */}
      <div className={styles.header}>
        <Link href="/v3/dashboard/filings" className={styles.backBtn}>← All filings</Link>
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <div className={styles.title}>IFTA · {filing.year} Q{filing.quarter}</div>
            <Pill tone={statusTone(filing.status)}>{statusLabel(filing.status)}</Pill>
          </div>
          <div className={styles.sub}>
            {filing.periodStart || filing.periodEnd ? `${fmtDate(filing.periodStart)} – ${fmtDate(filing.periodEnd)}` : `Q${filing.quarter} · ${filing.year}`}
            {' · '}Updated {fmtRelative(filing.updatedAt)}
          </div>
        </div>
        <div className={styles.headerActions}>
          {actionError && <span style={{ fontSize: 12, color: 'var(--v3-danger)' }}>{actionError}</span>}
          {isSigned && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--v3-success)', background: 'var(--v3-success-bg)', padding: '5px 10px', borderRadius: 20 }}>
              <span>✓</span>
              <span>Signed by {filing.authorization!.signerName}{filing.authorization!.signedAt ? ` · ${fmtDate(filing.authorization!.signedAt)}` : ''}</span>
            </div>
          )}
          <button onClick={() => setUploading(true)} className={styles.btnSecondary}>Upload document</button>
          {canSubmit && (
            isSigned ? (
              <button onClick={() => doAction(`/api/v1/features/ifta-v2/filings/${filing.id}/submit`)} disabled={actionLoading} className={styles.btnPrimary} style={{ opacity: actionLoading ? 0.7 : 1, cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
                {actionLoading ? 'Submitting…' : 'Submit for review'}
              </button>
            ) : (
              <button onClick={() => setDisclosureOpen(true)} className={styles.btnPrimary}>
                Sign &amp; submit
              </button>
            )
          )}
          {canApprove && (
            <>
              <button onClick={() => setRejecting(true)} className={styles.btnDanger}>Request changes</button>
              <button onClick={() => doAction(`/api/v1/features/ifta-v2/filings/${filing.id}/client-approve`)} disabled={actionLoading} className={styles.btnPrimary} style={{ opacity: actionLoading ? 0.7 : 1, cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
                {actionLoading ? 'Approving…' : 'Approve filing'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Step tracker */}
      <StepTracker status={filing.status} />

      {/* Staff notes */}
      {filing.notesClientVisible && (
        <Card>
          <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>Note from Ewall</div>
          <div style={{ fontSize: 13, color: 'var(--v3-ink)', lineHeight: 1.6 }}>{filing.notesClientVisible}</div>
        </Card>
      )}

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.main}>

          {/* Summary */}
          <Card>
            <SectionHeader title="Filing summary" />
            <div className={styles.metaGrid} style={{ marginTop: 16 }}>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Year</div><div className={styles.metaValue}>{filing.year}</div></div>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Quarter</div><div className={styles.metaValue}>Q{filing.quarter}</div></div>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Period start</div><div className={styles.metaValue}>{fmtDate(filing.periodStart)}</div></div>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Period end</div><div className={styles.metaValue}>{fmtDate(filing.periodEnd)}</div></div>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Total miles</div><div className={styles.metaValue}>{fmtNum(filing.totalDistance)}</div></div>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Total fuel (gal)</div><div className={styles.metaValue}>{fmtNum(filing.totalFuelGallons, 3)}</div></div>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Fleet MPG</div><div className={styles.metaValue}>{filing.fleetMpg ? filing.fleetMpg.toFixed(2) : '—'}</div></div>
              <div className={styles.metaItem}><div className={styles.metaLabel}>Net tax</div>
                <div className={styles.metaValue} style={{ color: filing.totalNetTax != null && filing.totalNetTax < 0 ? 'var(--v3-success)' : 'var(--v3-ink)' }}>
                  {filing.totalNetTax != null && filing.totalNetTax < 0 ? `(${fmtMoney(filing.totalNetTax)})` : fmtMoney(filing.totalNetTax)}
                </div>
              </div>
            </div>
          </Card>

          {/* Jurisdiction table — editable paid gallons */}
          <JurisdictionTable filing={filing} canEdit={canEdit} />

          {/* Documents */}
          <Card noPadding>
            <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Documents" subtitle={`${initialDocs.length} file${initialDocs.length !== 1 ? 's' : ''}`} />
              <button onClick={() => setUploading(true)} className={styles.btnSecondary} style={{ fontSize: 12 }}>+ Upload</button>
            </div>
            {initialDocs.length === 0 ? (
              <div className={styles.emptyState}>No documents uploaded yet.</div>
            ) : (
              <div className={styles.tableWrap} style={{ border: 'none', borderRadius: 0 }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>File</th>
                      <th className={`${styles.th} ${styles.thRight}`}>Size</th>
                      <th className={styles.th}>Uploaded</th>
                      <th className={styles.th} style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialDocs.map(d => (
                      <tr key={d.id}>
                        <td className={styles.td}>
                          <div style={{ fontWeight: 500 }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{d.fileName}</div>
                        </td>
                        <td className={`${styles.td} ${styles.tdRight} ${styles.tdMuted}`}>{fmtFileSize(d.fileSize)}</td>
                        <td className={`${styles.td} ${styles.tdMuted}`}>{fmtRelative(d.createdAt)}</td>
                        <td className={styles.td}>
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
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v3-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>What to do next</div>
            {canSubmit && (
              isSigned
                ? <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.6 }}>Disclosure signed. Click <strong>Submit for review</strong> when ready.</div>
                : <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.6 }}>Upload your fuel receipts, enter paid gallons per state using <strong>Edit fuel data</strong>, then click <strong>Sign &amp; submit</strong> to certify and submit for review.</div>
            )}
            {(filing.status === 'READY_FOR_REVIEW' || filing.status === 'IN_REVIEW') && <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.6 }}>Your filing is with the Ewall team. We&apos;ll notify you when it&apos;s ready for your approval.</div>}
            {filing.status === 'SNAPSHOT_READY' && <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.6 }}>We&apos;re preparing the final version for your approval.</div>}
            {canApprove && <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.6 }}>Review the jurisdiction breakdown and approve the filing so Ewall can submit it to the agency.</div>}
            {filing.status === 'FINALIZED' && <div style={{ fontSize: 12.5, color: 'var(--v3-success)', fontWeight: 500, lineHeight: 1.6 }}>This filing has been submitted and finalized.</div>}
            {['ARCHIVED', 'APPROVED'].includes(filing.status) && <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', lineHeight: 1.6 }}>This filing is complete.</div>}
          </Card>

          <Card>
            <SectionHeader title="Activity" />
            {filing.audits.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--v3-muted)', marginTop: 12 }}>No activity yet.</div>
            ) : (
              <div className={styles.logList} style={{ marginTop: 10 }}>
                {filing.audits.map(a => (
                  <div key={a.id} className={styles.logItem}>
                    <div className={styles.logDot} />
                    <div>
                      <div className={styles.logText}>{auditLabel(a.action, a.message)}</div>
                      <div className={styles.logTime}>{fmtRelative(a.createdAt)}</div>
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
