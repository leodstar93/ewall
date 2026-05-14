'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { PageHeader } from '@/app/v3/components/ui/PageHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import s from '@/app/v3/components/ui/settings.module.css'

interface CompanyData {
  legalName: string | null; dbaName: string | null
  dotNumber: string | null; mcNumber: string | null; ein: string | null
  phone: string | null; addressLine1: string | null
  city: string | null; state: string | null; zipCode: string | null
  saferPowerUnits: number | null; saferDrivers: number | null
  saferOperatingStatus: string | null; saferEntityType: string | null
}

type CompanyForm = {
  legalName: string; dbaName: string
  dotNumber: string; mcNumber: string; ein: string
  businessPhone: string; addressLine1: string
  city: string; state: string; zipCode: string
}

type SaferCompany = {
  legalName?: string | null; dbaName?: string | null
  dotNumber?: string | null; mcNumber?: string | null; businessPhone?: string | null
  addressLine1?: string | null; city?: string | null; state?: string | null; zipCode?: string | null
}

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={s.field} style={{ gridColumn: `span ${span}` }}>
      <label className={s.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={s.input} {...props} />
}

export function CompanyPageClient({ company }: { company: CompanyData }) {
  const [form, setForm] = useState<CompanyForm>({
    legalName:     company.legalName    ?? '',
    dbaName:       company.dbaName      ?? '',
    dotNumber:     company.dotNumber    ?? '',
    mcNumber:      company.mcNumber     ?? '',
    ein:           company.ein          ?? '',
    businessPhone: company.phone        ?? '',
    addressLine1:  company.addressLine1 ?? '',
    city:          company.city         ?? '',
    state:         company.state        ?? '',
    zipCode:       company.zipCode      ?? '',
  })

  const [saving, setSaving]       = useState(false)
  const [saferLoading, setSaferLoading] = useState(false)
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null)

  function bind(k: keyof CompanyForm) {
    return { value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value })) }
  }

  async function searchSafer() {
    const dot = form.dotNumber.trim().replace(/\D/g, '')
    if (!dot) { setMsg({ text: 'Enter a USDOT number first.', ok: false }); return }
    setSaferLoading(true); setMsg(null)
    try {
      const res  = await fetch('/api/v1/integrations/safer/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dotNumber: dot }),
      })
      const data = await res.json().catch(() => ({})) as { found?: boolean; company?: SaferCompany; warnings?: string[]; error?: string }
      if (!res.ok) { setMsg({ text: data.error ?? 'SAFER lookup failed.', ok: false }); return }
      if (!data.found || !data.company) { setMsg({ text: data.warnings?.[0] ?? 'No carrier found.', ok: false }); return }
      const c = data.company
      const patch: Partial<CompanyForm> = {}
      if (c.legalName)     patch.legalName     = c.legalName
      if (c.dbaName)       patch.dbaName       = c.dbaName
      if (c.dotNumber)     patch.dotNumber     = c.dotNumber
      if (c.mcNumber)      patch.mcNumber      = c.mcNumber
      if (c.businessPhone) patch.businessPhone = c.businessPhone
      if (c.addressLine1)  patch.addressLine1  = c.addressLine1
      if (c.city)          patch.city          = c.city
      if (c.state)         patch.state         = c.state
      if (c.zipCode)       patch.zipCode       = c.zipCode
      setForm(p => ({ ...p, ...patch }))
      setMsg({ text: 'Carrier data loaded from SAFER. Review and save.', ok: true })
    } catch {
      setMsg({ text: "Couldn't reach SAFER right now.", ok: false })
    } finally {
      setSaferLoading(false)
    }
  }

  async function save() {
    setSaving(true); setMsg(null)
    const res  = await fetch('/api/v1/settings/company', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    setMsg(res.ok ? { text: 'Company profile saved.', ok: true } : { text: (data as { error?: string }).error ?? 'Save failed.', ok: false })
    if (res.ok) setTimeout(() => setMsg(null), 4000)
  }

  const authority = [
    { l: 'Operating status', v: company.saferOperatingStatus ?? '—' },
    { l: 'Entity type',      v: company.saferEntityType      ?? '—' },
    { l: 'Power units',      v: company.saferPowerUnits != null ? String(company.saferPowerUnits) : '—' },
    { l: 'Drivers',          v: company.saferDrivers    != null ? String(company.saferDrivers)    : '—' },
  ]

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader title="Company profile" subtitle="Used on filings, invoices, and your public carrier profile." />

      <Card>
        <SectionHeader
          title="Profile"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {msg && (
                <span style={{ fontSize: 11.5, color: msg.ok ? 'var(--v3-success)' : 'var(--v3-danger)' }}>{msg.text}</span>
              )}
              <button
                onClick={searchSafer}
                disabled={saferLoading}
                className={s.btnSecondary}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 11px', opacity: saferLoading ? 0.7 : 1, cursor: saferLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
              >
                <V3Icon name="sparkle" size={12} />
                {saferLoading ? 'Searching…' : 'Search SAFER'}
              </button>
            </div>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Legal name"><Input {...bind('legalName')} /></Field>
          <Field label="DBA / Trade name"><Input {...bind('dbaName')} /></Field>
          <Field label="USDOT number"><Input {...bind('dotNumber')} inputMode="numeric" /></Field>
          <Field label="MC number"><Input {...bind('mcNumber')} /></Field>
          <Field label="EIN"><Input {...bind('ein')} /></Field>
          <Field label="Phone"><Input {...bind('businessPhone')} inputMode="tel" /></Field>
          <Field label="Street address" span={2}><Input {...bind('addressLine1')} /></Field>
          <Field label="City"><Input {...bind('city')} /></Field>
          <Field label="State / ZIP">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input {...bind('state')} placeholder="State" />
              <Input {...bind('zipCode')} placeholder="ZIP" inputMode="numeric" />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Operating authority" subtitle="From FMCSA SAFER — updated automatically." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {authority.map(b => (
            <div key={b.l} style={{ padding: '12px 14px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, color: 'var(--v3-muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{b.l}</div>
              <div style={{ fontSize: 13, color: 'var(--v3-ink)', fontWeight: 500, marginTop: 5 }}>{b.v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className={s.actions}>
        <button className={s.btnPrimary} onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
