'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { PageHeader } from '@/app/v3/components/ui/PageHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'

interface IntegrationRow {
  id: string; provider: string; status: string
  orgName: string | null; lastSyncedAt: string | null
}

type EldStatusItem = {
  id: string; provider: string; status: string
  externalOrgName?: string | null; orgName?: string | null
  lastSuccessfulSyncAt?: string | null; lastSyncedAt?: string | null
}

const PROVIDER_META: Record<string, { name: string; desc: string }> = {
  MOTIVE:  { name: 'Motive ELD',  desc: 'Auto-import HOS, miles, and IFTA jurisdictions from your Motive fleet.' },
  SAMSARA: { name: 'Samsara ELD', desc: 'Import HOS and IFTA mileage from Samsara-equipped trucks.' },
}

const STATIC_INTEGRATIONS = [
  { name: 'QuickBooks Online', desc: 'Push invoices, fuel receipts, and IFTA payments to your accounting.' },
  { name: 'WEX fuel card',     desc: 'Import fuel purchases automatically and reconcile against IFTA.' },
  { name: 'Comdata fuel card', desc: 'Alternative fuel-card import for IFTA.' },
  { name: 'IRS e-file (2290)', desc: 'Direct submission to IRS with stamped Schedule 1 returned to your inbox.' },
]

const SUPPORTED_ELD = [
  { provider: 'MOTIVE',  comingSoon: false },
  { provider: 'SAMSARA', comingSoon: true  },
]

function eldTone(status: string): PillTone {
  if (status === 'CONNECTED') return 'success'
  if (status === 'EXPIRED' || status === 'ERROR') return 'danger'
  if (status === 'PENDING') return 'warn'
  return 'neutral'
}

function fmtClientDate(d: string | null | undefined): string | null {
  if (!d) return null
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return null }
}

export function IntegrationsPageClient({ integrationRows }: { integrationRows: IntegrationRow[] }) {
  const router = useRouter()

  const [eldList, setEldList]           = useState<EldStatusItem[]>(() =>
    integrationRows.map(r => ({ id: r.id, provider: r.provider, status: r.status, orgName: r.orgName, lastSyncedAt: r.lastSyncedAt }))
  )
  const [loading, setLoading]           = useState(true)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [connecting, setConnecting]     = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [inlineMsg, setInlineMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  async function fetchEld() {
    try {
      const res = await fetch('/api/v1/integrations/eld/status')
      if (res.ok) {
        const data: unknown = await res.json()
        if (Array.isArray(data)) setEldList(data as EldStatusItem[])
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const eldConnected = params.get('eldConnected')
    const eldPending   = params.get('eldPending')
    const eldError     = params.get('eldError')

    if (eldConnected || eldPending || eldError) {
      const url = new URL(window.location.href)
      ;['eldConnected','eldPending','eldError','eldSync','eldSyncJobId'].forEach(k => url.searchParams.delete(k))
      window.history.replaceState({}, '', url.toString())
    }

    if (eldPending === 'true') {
      setPendingConfirm(true)
    } else if (eldConnected === 'true') {
      setInlineMsg({ text: 'Motive ELD connected successfully.', ok: true })
    } else if (eldError) {
      setInlineMsg({ text: `ELD connection failed: ${decodeURIComponent(eldError)}`, ok: false })
    }

    fetchEld()
  }, [])

  async function confirmConnection(provider = 'MOTIVE') {
    setConfirmLoading(true)
    try {
      const res  = await fetch('/api/v1/integrations/eld/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setInlineMsg({ text: (data as { error?: string }).error ?? 'Confirm failed.', ok: false }); return }
      setPendingConfirm(false)
      setInlineMsg({ text: 'ELD connection confirmed — syncing data now.', ok: true })
      setEldList(prev => {
        const exists = prev.some(e => e.provider === provider)
        if (exists) return prev.map(e => e.provider === provider ? { ...e, status: 'CONNECTED' } : e)
        const acct = (data as { account?: { id?: string } }).account
        return [...prev, { id: acct?.id ?? '', provider, status: 'CONNECTED', orgName: null, lastSyncedAt: null }]
      })
      fetchEld()
    } catch {
      setInlineMsg({ text: 'Could not confirm connection.', ok: false })
    } finally {
      setConfirmLoading(false)
    }
  }

  async function connectEld(provider: string) {
    setConnecting(provider)
    try {
      const returnTo = window.location.pathname
      const res  = await fetch('/api/v1/integrations/eld/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, returnTo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !(data as { authorizationUrl?: string }).authorizationUrl) {
        setInlineMsg({ text: (data as { error?: string }).error ?? 'Could not start ELD connection.', ok: false })
        setConnecting(null); return
      }
      window.location.href = (data as { authorizationUrl: string }).authorizationUrl
    } catch {
      setInlineMsg({ text: 'Could not start ELD connection.', ok: false })
      setConnecting(null)
    }
  }

  async function disconnectEld(provider: string) {
    setDisconnecting(provider)
    try {
      const res  = await fetch('/api/v1/integrations/eld/disconnect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setInlineMsg({ text: (data as { error?: string }).error ?? 'Disconnect failed.', ok: false }); return }
      setEldList(prev => prev.filter(e => e.provider !== provider))
      setInlineMsg({ text: `${PROVIDER_META[provider]?.name ?? provider} disconnected.`, ok: true })
    } catch {
      setInlineMsg({ text: 'Could not disconnect.', ok: false })
    } finally {
      setDisconnecting(null)
    }
  }

  void router

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader title="Integrations" subtitle="Connect the systems Ewall reads from to automate filings." />

      {pendingConfirm && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--v3-warn-bg)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <V3Icon name="bell" size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 2 }}>ELD authorization pending</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)' }}>Your ELD provider needs a final confirmation to start syncing data.</div>
            </div>
            <button onClick={() => confirmConnection()} disabled={confirmLoading} className={s.btnPrimary}
              style={{ flexShrink: 0, fontSize: 12.5, opacity: confirmLoading ? 0.7 : 1, cursor: confirmLoading ? 'not-allowed' : 'pointer' }}>
              {confirmLoading ? 'Confirming…' : 'Confirm connection'}
            </button>
          </div>
        </Card>
      )}

      {inlineMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 9, fontSize: 12.5,
          background: inlineMsg.ok ? 'var(--v3-success-bg)' : 'var(--v3-danger-bg)',
          color: inlineMsg.ok ? 'var(--v3-success)' : 'var(--v3-danger)',
          border: `1px solid ${inlineMsg.ok ? 'var(--v3-success)' : 'var(--v3-danger)'}`,
        }}>
          {inlineMsg.ok ? '✓' : '✕'} {inlineMsg.text}
          <button onClick={() => setInlineMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 'auto' }}>×</button>
        </div>
      )}

      <Card>
        <SectionHeader title="ELD integrations" subtitle="Auto-import HOS and IFTA mileage from your ELD provider." />
        {loading && eldList.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {SUPPORTED_ELD.map(({ provider, comingSoon }) => {
              const meta        = PROVIDER_META[provider] ?? { name: provider, desc: '' }
              const existing    = eldList.find(e => e.provider === provider)
              const status      = existing?.status ?? 'DISCONNECTED'
              const tone        = eldTone(status)
              const isConnected = status === 'CONNECTED'
              const isPending   = status === 'PENDING'
              const isError     = status === 'EXPIRED' || status === 'ERROR'
              const syncDate    = existing?.lastSyncedAt ?? fmtClientDate(existing?.lastSuccessfulSyncAt)
              const orgName     = existing?.orgName ?? existing?.externalOrgName ?? null

              return (
                <div key={provider} style={{
                  border: `1px solid ${isConnected ? 'var(--v3-success)' : 'var(--v3-line)'}`,
                  borderRadius: 10, padding: 16,
                  background: isConnected ? 'var(--v3-success-bg)' : 'var(--v3-bg)',
                  opacity: comingSoon ? 0.65 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{meta.name}</div>
                      {orgName && <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{orgName}</div>}
                      <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{meta.desc}</div>
                    </div>
                    {comingSoon
                      ? <Pill tone="neutral">Coming soon</Pill>
                      : (isConnected || isPending || isError) && <Pill tone={tone}>{status.charAt(0) + status.slice(1).toLowerCase()}</Pill>
                    }
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--v3-soft-line)' }}>
                    <div style={{ fontSize: 11, color: 'var(--v3-muted)' }}>
                      {comingSoon ? 'Coming soon' : syncDate ? `Synced ${syncDate}` : isConnected ? 'Connected' : 'Not connected'}
                    </div>
                    {!comingSoon && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isConnected && (
                          <button onClick={() => disconnectEld(provider)} disabled={disconnecting === provider}
                            style={{ background: 'transparent', color: 'var(--v3-danger)', border: '1px solid var(--v3-danger-bg)', borderRadius: 6, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, cursor: disconnecting === provider ? 'not-allowed' : 'pointer', opacity: disconnecting === provider ? 0.7 : 1 }}>
                            {disconnecting === provider ? 'Disconnecting…' : 'Disconnect'}
                          </button>
                        )}
                        {isPending && (
                          <button onClick={() => confirmConnection(provider)} disabled={confirmLoading} className={s.btnPrimary}
                            style={{ fontSize: 11.5, padding: '5px 11px', opacity: confirmLoading ? 0.7 : 1, cursor: confirmLoading ? 'not-allowed' : 'pointer' }}>
                            {confirmLoading ? 'Confirming…' : 'Confirm'}
                          </button>
                        )}
                        {!isConnected && !isPending && (
                          <button onClick={() => connectEld(provider)} disabled={connecting === provider}
                            style={{ background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, cursor: connecting === provider ? 'not-allowed' : 'pointer', opacity: connecting === provider ? 0.7 : 1 }}>
                            {connecting === provider ? 'Redirecting…' : isError ? 'Reconnect' : 'Connect'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Other integrations" subtitle="More connections coming soon." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {STATIC_INTEGRATIONS.map(int => (
            <div key={int.name} style={{ border: '1px solid var(--v3-line)', borderRadius: 10, padding: 16, opacity: 0.7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{int.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{int.desc}</div>
                </div>
                <Pill tone="neutral">Coming soon</Pill>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
