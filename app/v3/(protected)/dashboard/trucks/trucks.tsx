'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--v3-line)',
  borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
  fontFamily: 'var(--v3-font)', background: 'var(--v3-bg)', boxSizing: 'border-box',
}
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--v3-muted)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block',
}

// ── Add Truck Modal ───────────────────────────────────────────────────────────

function AddTruckModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ unitNumber: '', vin: '', make: '', model: '', year: '', plateNumber: '', grossWeight: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const body: Record<string, unknown> = { unitNumber: form.unitNumber.trim() }
    if (form.vin.trim())         body.vin         = form.vin.trim()
    if (form.make.trim())        body.make        = form.make.trim()
    if (form.model.trim())       body.model       = form.model.trim()
    if (form.year.trim())        body.year        = Number(form.year)
    if (form.plateNumber.trim()) body.plateNumber = form.plateNumber.trim()
    if (form.grossWeight.trim()) body.grossWeight = Number(form.grossWeight)
    try {
      const res = await fetch('/api/v1/features/ifta/trucks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Failed to create truck')
        return
      }
      onSuccess()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v3-panel)', borderRadius: 14, padding: '28px 28px 24px', width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v3-ink)' }}>Add a truck</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', padding: 4, fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL_STYLE}>Unit # <span style={{ color: 'var(--v3-danger)' }}>*</span></label>
            <input style={INPUT_STYLE} value={form.unitNumber} onChange={e => set('unitNumber', e.target.value)} placeholder="e.g. TRK-101" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Make</label>
              <input style={INPUT_STYLE} value={form.make} onChange={e => set('make', e.target.value)} placeholder="e.g. Freightliner" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Model</label>
              <input style={INPUT_STYLE} value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. Cascadia" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Year</label>
              <input style={INPUT_STYLE} type="number" min={1900} max={new Date().getFullYear() + 1} value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2022" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Plate #</label>
              <input style={INPUT_STYLE} value={form.plateNumber} onChange={e => set('plateNumber', e.target.value)} placeholder="e.g. TX-7823A" />
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>VIN</label>
            <input style={{ ...INPUT_STYLE, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} value={form.vin} onChange={e => set('vin', e.target.value)} placeholder="17-character VIN" maxLength={17} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Gross Weight (lbs)</label>
            <input style={INPUT_STYLE} type="number" min={0} value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)} placeholder="e.g. 80000" />
          </div>
          {error && (
            <div style={{ fontSize: 12.5, color: 'var(--v3-danger)', background: 'var(--v3-danger-bg)', padding: '8px 12px', borderRadius: 7 }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '8px 18px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Adding…' : 'Add truck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface TruckRow {
  id: string
  unitNumber: string
  model: string
  vin: string
  plate: string
  isActive: boolean
  driverName: string | null
  lastOdometerMiles: number | null
}

interface Props {
  companyName: string
  trucks: TruckRow[]
  totalCount: number
  activeCount: number
  inactiveCount: number
  missingVinCount: number
}

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientTrucksPage({ companyName, trucks, totalCount, activeCount, inactiveCount, missingVinCount }: Props) {
  const router = useRouter()
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState<{ text: string; ok: boolean } | null>(null)
  const [addTruckOpen, setAddTruckOpen] = useState(false)

  async function syncFromEld() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res  = await fetch('/api/v1/features/ifta/trucks/sync-provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
      if (!res.ok) {
        setSyncMsg({ text: data.error ?? 'Sync failed.', ok: false })
      } else {
        setSyncMsg({ text: data.message ?? 'Trucks synced successfully.', ok: true })
        router.refresh()
      }
    } catch {
      setSyncMsg({ text: 'Could not reach the server.', ok: false })
    } finally {
      setSyncing(false)
    }
  }

  const stats = [
    { l: 'Total trucks',   v: totalCount,     tone: undefined },
    { l: 'Active',         v: activeCount,    tone: undefined },
    { l: 'Inactive',       v: inactiveCount,  tone: inactiveCount > 0 ? 'var(--v3-warn)' : undefined },
    { l: 'Missing VIN',    v: missingVinCount, tone: missingVinCount > 0 ? 'var(--v3-danger)' : undefined },
  ]

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {addTruckOpen && (
        <AddTruckModal
          onClose={() => setAddTruckOpen(false)}
          onSuccess={() => { setAddTruckOpen(false); router.refresh() }}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {stats.map(s => (
          <Card key={s.l} padding={18}>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: s.tone ?? 'var(--v3-ink)', marginTop: 10, letterSpacing: -0.5 }}>{s.v}</div>
          </Card>
        ))}
      </div>

      <Card noPadding>
        <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.2 }}>My trucks</div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Vehicles registered to {companyName}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {syncMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '5px 10px', borderRadius: 7,
                background: syncMsg.ok ? 'var(--v3-success-bg)' : 'var(--v3-danger-bg)',
                color: syncMsg.ok ? 'var(--v3-success)' : 'var(--v3-danger)',
                border: `1px solid ${syncMsg.ok ? 'var(--v3-success)' : 'var(--v3-danger)'}` }}>
                {syncMsg.ok ? '✓' : '✕'} {syncMsg.text}
                <button onClick={() => setSyncMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 4 }}>×</button>
              </div>
            )}
            <button
              onClick={() => void syncFromEld()}
              disabled={syncing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--v3-primary)', border: '1px solid var(--v3-line)', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: syncing ? 0.7 : 1 }}>
              <V3Icon name="sparkle" size={13} />
              {syncing ? 'Syncing…' : 'Sync from ELD'}
            </button>
            <button onClick={() => setAddTruckOpen(true)} style={{ background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>+ Add truck</button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Unit', 'VIN', 'Plate', 'Driver', 'Odometer', 'Status'].map((h, i) => (
                <th key={h} style={{ ...TH_STYLE, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trucks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No trucks registered yet. Add your first truck to get started.
                </td>
              </tr>
            ) : trucks.map(t => {
              const tone: PillTone = t.isActive ? 'success' : 'neutral'
              const status = t.isActive ? 'Active' : 'Inactive'
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                  <td style={{ padding: '13px 20px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--v3-ink)' }}>{t.unitNumber || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{t.model}</div>
                  </td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{t.vin}</td>
                  <td style={{ padding: '13px 20px', color: 'var(--v3-ink)', fontSize: 12 }}>{t.plate}</td>
                  <td style={{ padding: '13px 20px', color: t.driverName ? 'var(--v3-ink)' : 'var(--v3-muted)', fontSize: 12 }}>{t.driverName ?? '—'}</td>
                  <td style={{ padding: '13px 20px', textAlign: 'right', color: t.lastOdometerMiles != null ? 'var(--v3-ink)' : 'var(--v3-muted)', fontSize: 12 }}>
                    {t.lastOdometerMiles != null ? t.lastOdometerMiles.toLocaleString() + ' mi' : '—'}
                  </td>
                  <td style={{ padding: '13px 20px' }}><Pill tone={tone}>{status}</Pill></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
