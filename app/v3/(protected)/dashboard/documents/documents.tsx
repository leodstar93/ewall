'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

interface DocRow {
  id: string
  name: string
  tag: string
  size: string
  uploaded: string
  fileUrl: string
}

interface Props {
  docRows: DocRow[]
}

const TH_STYLE = { padding: '9px 20px', fontSize: 10.5, color: 'var(--v3-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const }

export function ClientDocumentsPage({ docRows }: Props) {
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
          <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>{docRows.length} file{docRows.length !== 1 ? 's' : ''}</div>
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
            {docRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No documents uploaded yet.
                </td>
              </tr>
            ) : docRows.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <V3Icon name="file" size={14} />
                    </div>
                    <div style={{ color: 'var(--v3-ink)', fontWeight: 500 }}>{d.name}</div>
                  </div>
                </td>
                <td style={{ padding: '13px 20px' }}>
                  <span style={{ background: 'var(--v3-chip-bg)', color: 'var(--v3-ink)', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500 }}>{d.tag}</span>
                </td>
                <td style={{ padding: '13px 20px', textAlign: 'right', color: 'var(--v3-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.size}</td>
                <td style={{ padding: '13px 20px', color: 'var(--v3-muted)' }}>{d.uploaded}</td>
                <td style={{ padding: '13px 20px' }}>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', display: 'grid', placeItems: 'center' }}>
                    <V3Icon name="download" size={15} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
