'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

interface Props { userName?: string }

const DOCS = [
  { name: 'COI_Progressive_2026.pdf',        kind: 'Insurance', size: '284 KB',  updated: 'May 04', tag: 'Insurance' },
  { name: 'Fuel_receipts_April.zip',          kind: 'Receipts',  size: '4.1 MB',  updated: 'May 01', tag: 'Receipts' },
  { name: 'Schedule1_2026.pdf',               kind: '2290 Proof',size: '142 KB',  updated: 'Apr 02', tag: '2290' },
  { name: 'TX_Apportioned_Reg_TRK-411.pdf',  kind: 'Permit',    size: '142 KB',  updated: 'Apr 18', tag: 'Permit' },
  { name: 'CDL_AnaMorales_renewal.pdf',       kind: 'License',   size: '88 KB',   updated: 'Apr 12', tag: 'License' },
]

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientDocumentsPage({ userName: _ }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card style={{ borderStyle: 'dashed', borderWidth: '1.5px', background: 'var(--v3-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)', display: 'grid', placeItems: 'center' }}>
              <V3Icon name="upload" size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink)' }}>Drop files here or click to upload</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>PDF, JPG, PNG, ZIP — up to 50 MB. We auto-tag receipts and licenses.</div>
            </div>
          </div>
          <button style={{ padding: '10px 16px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Choose files</button>
        </div>
      </Card>

      <Card noPadding>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)' }}>My documents</div>
          <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>{DOCS.length} files · 1.4 GB of 50 GB used</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--v3-line)', borderBottom: '1px solid var(--v3-line)', background: 'var(--v3-bg)' }}>
              {['Name', 'Tag', 'Size', 'Uploaded', ''].map((h, i) => (
                <th key={i} style={{ ...TH_STYLE, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOCS.map(d => (
              <tr key={d.name} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <V3Icon name="file" size={14} />
                    </div>
                    <div>
                      <div style={{ color: 'var(--v3-ink)', fontWeight: 500 }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{d.kind}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 20px' }}>
                  <span style={{ background: 'var(--v3-chip-bg)', color: 'var(--v3-ink)', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500 }}>{d.tag}</span>
                </td>
                <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.size}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>{d.updated}</td>
                <td style={{ padding: '13px 20px' }}>
                  <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', display: 'grid', placeItems: 'center' }}>
                    <V3Icon name="download" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
