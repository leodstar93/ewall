'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuditRow { id: string; title: string; message: string; level: string; when: string }

interface Props {
  userEmail: string
  userId: string
  auditRows: AuditRow[]
}

type Section = 'notifications' | 'security' | 'audit'

type NotifState = {
  iftaDue: boolean; ucrDue: boolean; dmvExpiry: boolean
  paymentConfirm: boolean; paymentFail: boolean
  docOcr: boolean; weeklySummary: boolean
  teamInvite: boolean; securityAlerts: boolean; marketing: boolean
}

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'notifications', label: 'Notifications', icon: <V3Icon name="bell"    size={15} /> },
  { id: 'security',      label: 'Security',      icon: <V3Icon name="shield"  size={15} /> },
  { id: 'audit',         label: 'Audit log',     icon: <V3Icon name="clock"   size={15} /> },
]

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: () => void; label: string; desc?: string }) {
  return (
    <div className={s.toggle}>
      <div className={s.toggleText}>
        <div className={s.toggleLabel}>{label}</div>
        {desc && <div className={s.toggleDesc}>{desc}</div>}
      </div>
      <button type="button" onClick={onChange} className={s.toggleTrack} style={{ background: on ? 'var(--v3-primary)' : 'var(--v3-soft-line)' }}>
        <span className={s.toggleThumb} style={{ left: on ? 16 : 2 }} />
      </button>
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={s.input} {...props} />
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <label className={s.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

// ── Notifications ──────────────────────────────────────────────────────────────

function NotificationsPanel({ state, onChange }: { state: NotifState; onChange: (k: keyof NotifState) => void }) {
  return (
    <>
      <Card>
        <SectionHeader title="Compliance reminders" />
        <Toggle on={state.iftaDue}   onChange={() => onChange('iftaDue')}   label="IFTA filing deadlines"    desc="Email + dashboard alert 14 / 7 / 1 days before each quarter closes." />
        <Toggle on={state.ucrDue}    onChange={() => onChange('ucrDue')}    label="UCR registration window"  desc="Reminder when annual UCR opens and 30 days before lapse." />
        <Toggle on={state.dmvExpiry} onChange={() => onChange('dmvExpiry')} label="DMV registration expiry"  desc="Per-unit reminders 60 / 30 / 7 days before expiration." />
      </Card>
      <Card>
        <SectionHeader title="Payments & filings" />
        <Toggle on={state.paymentConfirm} onChange={() => onChange('paymentConfirm')} label="Payment confirmations"  desc="Receipt emailed when a filing or invoice is paid." />
        <Toggle on={state.paymentFail}    onChange={() => onChange('paymentFail')}    label="Payment failures"       desc="SMS + email if a scheduled payment is declined." />
        <Toggle on={state.docOcr}         onChange={() => onChange('docOcr')}         label="Document OCR completed" desc="Notify when scanned receipts have finished processing." />
        <Toggle on={state.weeklySummary}  onChange={() => onChange('weeklySummary')}  label="Weekly summary"         desc="Monday digest of last week's filings, payments, and what is due." />
      </Card>
      <Card>
        <SectionHeader title="Account" />
        <Toggle on={state.teamInvite}     onChange={() => onChange('teamInvite')}     label="Team invitations & role changes" />
        <Toggle on={state.securityAlerts} onChange={() => onChange('securityAlerts')} label="Security alerts" desc="New device sign-ins, password changes, MFA modifications." />
        <Toggle on={state.marketing}      onChange={() => onChange('marketing')}      label="Product updates & tips" />
      </Card>
    </>
  )
}

// ── Change password modal ──────────────────────────────────────────────────────

function ChangePasswordModal({ userId, onClose, onSuccess }: { userId: string; onClose: () => void; onSuccess: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit() {
    if (next !== confirm) { setError('New passwords do not match'); return }
    if (next.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError(null)
    const res  = await fetch(`/api/v1/users/${userId}/password`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed to change password'); return }
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: 28, width: 420, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Change password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Current password"><Input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="New password"><Input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm new password"><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
        </div>
        {error && <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7, marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={loading || !current || !next || !confirm} className={s.btnPrimary}
            style={{ opacity: loading || !current || !next || !confirm ? 0.7 : 1, cursor: loading || !current || !next || !confirm ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Security ───────────────────────────────────────────────────────────────────

function SecurityPanel({ userEmail, userId, onPasswordChanged }: { userEmail: string; userId: string; onPasswordChanged: () => void }) {
  const [pwModalOpen, setPwModalOpen] = useState(false)

  return (
    <>
      {pwModalOpen && (
        <ChangePasswordModal userId={userId} onClose={() => setPwModalOpen(false)} onSuccess={() => { setPwModalOpen(false); onPasswordChanged() }} />
      )}
      <Card>
        <SectionHeader title="Sign-in & 2FA" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Email"><Input defaultValue={userEmail} readOnly /></Field>
          <Field label="Password">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input type="password" defaultValue="••••••••••" readOnly style={{ flex: 1 }} />
              <button type="button" className={s.btnSecondary} style={{ whiteSpace: 'nowrap', fontSize: 12 }} onClick={() => setPwModalOpen(true)}>Change</button>
            </div>
          </Field>
        </div>
        <Toggle on={false} onChange={() => {}} label="Two-factor authentication" desc="Protect your account with an authenticator app." />
        <Toggle on={false} onChange={() => {}} label="IP allow-list" desc="Restrict admin access to specific IPs." />
      </Card>
      <Card>
        <SectionHeader title="Active sessions"
          action={<button style={{ background: 'transparent', color: 'var(--v3-danger)', border: '1px solid var(--v3-danger-bg)', borderRadius: 6, padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', fontWeight: 500 }}>Sign out all devices</button>}
        />
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--v3-bg)', borderRadius: 8, border: '1px solid var(--v3-line)', fontSize: 12.5, color: 'var(--v3-muted)' }}>
          Current session is active. Session details are managed by your sign-in provider.
        </div>
      </Card>
    </>
  )
}

// ── Audit log ──────────────────────────────────────────────────────────────────

function levelTone(level: string): PillTone {
  if (level === 'SUCCESS') return 'success'
  if (level === 'WARNING') return 'warn'
  if (level === 'ERROR')   return 'danger'
  return 'info'
}

function AuditPanel({ auditRows }: { auditRows: AuditRow[] }) {
  return (
    <Card noPadding>
      <div style={{ padding: '18px 20px 12px' }}>
        <SectionHeader title="Audit log" subtitle="Recent notifications and system events on your account."
          action={<button className={s.btnSecondary} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '6px 11px' }}><V3Icon name="download" size={12} /> Export CSV</button>}
        />
      </div>
      {auditRows.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>No activity yet.</div>
      ) : auditRows.map(e => {
        const tone  = levelTone(e.level)
        const bg    = tone === 'success' ? 'var(--v3-success-bg)' : tone === 'warn' ? 'var(--v3-warn-bg)' : tone === 'danger' ? 'var(--v3-danger-bg)' : 'var(--v3-primary-soft)'
        const color = tone === 'success' ? 'var(--v3-success)' : tone === 'warn' ? 'var(--v3-warn)' : tone === 'danger' ? 'var(--v3-danger)' : 'var(--v3-primary)'
        return (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'flex-start', gap: 12, padding: '13px 20px', borderTop: '1px solid var(--v3-soft-line)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, color, display: 'grid', placeItems: 'center' }}>
              <V3Icon name={tone === 'success' ? 'check' : tone === 'warn' ? 'shield' : 'more'} size={13} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--v3-ink)' }}>
              <span style={{ fontWeight: 500 }}>{e.title}</span>
              {e.message && <span style={{ color: 'var(--v3-muted)' }}> · {e.message}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', whiteSpace: 'nowrap' }}>{e.when}</div>
          </div>
        )
      })}
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function ClientSettingsPage({ userEmail, userId, auditRows }: Props) {
  const [section, setSection] = useState<Section>('notifications')
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [notifState, setNotifState] = useState<NotifState>({
    iftaDue: true, ucrDue: true, dmvExpiry: true,
    paymentConfirm: true, paymentFail: true,
    docOcr: false, weeklySummary: true,
    teamInvite: true, securityAlerts: true, marketing: false,
  })

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    if (type === 'success') setTimeout(() => setToast(null), 4000)
  }

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 300))
    setSaving(false)
    showToast('Notification preferences saved.', 'success')
  }

  return (
    <div className={s.page}>
      <nav className={s.sidenav}>
        <div className={s.sideLabel}>Settings</div>
        {SECTIONS.map(sec => (
          <button key={sec.id} type="button" className={s.sideBtn} data-active={section === sec.id}
            onClick={() => { setSection(sec.id); setToast(null) }}>
            {sec.icon}<span>{sec.label}</span>
          </button>
        ))}
        <div className={s.sideHint}>
          <div className={s.sideHintTitle}>Need a hand?</div>
          <div className={s.sideHintBody}>Our team can walk you through any of these settings.</div>
          <button className={s.sideHintBtn}>Contact support</button>
        </div>
      </nav>

      <div className={s.content}>
        {section === 'notifications' && (
          <NotificationsPanel state={notifState} onChange={k => setNotifState(p => ({ ...p, [k]: !p[k] }))} />
        )}
        {section === 'security' && (
          <SecurityPanel userEmail={userEmail} userId={userId} onPasswordChanged={() => showToast('Password changed successfully.', 'success')} />
        )}
        {section === 'audit' && <AuditPanel auditRows={auditRows} />}

        {section === 'notifications' && (
          <div className={s.actions}>
            {toast && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, fontSize: 12.5, background: toast.type === 'success' ? 'var(--v3-success-bg)' : 'var(--v3-danger-bg)', color: toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)', border: `1px solid ${toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)'}` }}>
                {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
                <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 4 }}>×</button>
              </div>
            )}
            <button className={s.btnSecondary} onClick={() => setToast(null)}>Cancel</button>
            <button className={s.btnPrimary} onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}

        {section !== 'notifications' && toast && (
          <div style={{ padding: '0 0 8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, fontSize: 12.5, background: toast.type === 'success' ? 'var(--v3-success-bg)' : 'var(--v3-danger-bg)', color: toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)', border: `1px solid ${toast.type === 'success' ? 'var(--v3-success)' : 'var(--v3-danger)'}` }}>
              {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
              <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 4 }}>×</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
