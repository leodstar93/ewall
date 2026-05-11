'use client'

import { useState } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { SectionHeader } from '@/app/v3/components/ui/SectionHeader'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'

type DocTag = 'IFTA' | 'UCR' | '2290' | 'DMV' | 'Fleet' | 'Billing' | 'Other'

const TAG_TONE: Record<DocTag, PillTone> = {
  IFTA: 'info', UCR: 'success', '2290': 'warn', DMV: 'danger', Fleet: 'neutral', Billing: 'neutral', Other: 'neutral',
}

const DOCS: {
  id: string; name: string; tag: DocTag; client: string
  size: string; uploaded: string; uploader: string
}[] = [
  { id: 'd1',  name: 'IFTA Q2 2026 — Mileage Report.xlsx',         tag: 'IFTA',    client: 'Truckers Unidos', size: '142 KB', uploaded: 'May 8, 2026',  uploader: 'Maria G.' },
  { id: 'd2',  name: 'Fuel Receipts — April 2026.zip',              tag: 'IFTA',    client: 'Truckers Unidos', size: '8.2 MB', uploaded: 'May 2, 2026',  uploader: 'Leo D.' },
  { id: 'd3',  name: 'UCR Certificate 2025.pdf',                    tag: 'UCR',     client: 'Truckers Unidos', size: '94 KB',  uploaded: 'Jan 16, 2025', uploader: 'System' },
  { id: 'd4',  name: 'Form 2290 FY2026 — Schedule 1 (Stamped).pdf', tag: '2290',    client: 'Truckers Unidos', size: '218 KB', uploaded: 'Apr 2, 2026',  uploader: 'System' },
  { id: 'd5',  name: 'TX Registration — T-01 to T-12.pdf',          tag: 'DMV',     client: 'Truckers Unidos', size: '512 KB', uploaded: 'Jan 20, 2026', uploader: 'Carlos R.' },
  { id: 'd6',  name: 'Insurance Certificate (COI) 2026.pdf',        tag: 'Fleet',   client: 'Truckers Unidos', size: '156 KB', uploaded: 'Jan 5, 2026',  uploader: 'Leo D.' },
  { id: 'd7',  name: 'CDL Renewal — Driver Rodriguez.pdf',          tag: 'Fleet',   client: 'Truckers Unidos', size: '88 KB',  uploaded: 'Mar 12, 2026', uploader: 'Maria G.' },
  { id: 'd8',  name: 'Invoice #INV-2026-0038.pdf',                  tag: 'Billing', client: 'Truckers Unidos', size: '62 KB',  uploaded: 'May 1, 2026',  uploader: 'System' },
]

const TH: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10.5, color: 'var(--v3-muted)',
  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left',
}

const ALL_TAGS: (DocTag | 'All')[] = ['All', 'IFTA', 'UCR', '2290', 'DMV', 'Fleet', 'Billing', 'Other']

export function AdminDocumentsPage() {
  const [tagFilter, setTagFilter] = useState<DocTag | 'All'>('All')
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState(false)

  const filtered = DOCS.filter(d => {
    const matchTag = tagFilter === 'All' || d.tag === tagFilter
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.client.toLowerCase().includes(search.toLowerCase())
    return matchTag && matchSearch
  })

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false) }}
        style={{
          border: `2px dashed ${dragging ? 'var(--v3-primary)' : 'var(--v3-line)'}`,
          borderRadius: 12, padding: '28px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'var(--v3-primary-soft)' : 'var(--v3-panel)',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ color: dragging ? 'var(--v3-primary)' : 'var(--v3-muted)', display: 'inline-flex' }}>
          <V3Icon name="upload" size={24} />
        </span>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 10 }}>
          Drop files here, or <span style={{ color: 'var(--v3-primary)', cursor: 'pointer' }}>browse</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4 }}>
          PDF, XLSX, ZIP — up to 50 MB per file
        </div>
      </div>

      {/* Documents table */}
      <Card noPadding>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <SectionHeader title="All documents" subtitle={`${DOCS.length} files`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            style={{
              padding: '7px 11px', background: 'var(--v3-bg)', border: '1px solid var(--v3-line)',
              borderRadius: 7, fontSize: 12.5, color: 'var(--v3-ink)', outline: 'none',
              fontFamily: 'var(--v3-font)', width: 220,
            }}
          />
        </div>

        {/* Tag filter tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid var(--v3-line)', overflowX: 'auto' }}>
          {ALL_TAGS.map(t => (
            <button key={t} onClick={() => setTagFilter(t)} style={{
              padding: '6px 12px', border: 'none', borderRadius: '6px 6px 0 0',
              background: tagFilter === t ? 'var(--v3-primary-soft)' : 'transparent',
              color: tagFilter === t ? 'var(--v3-primary)' : 'var(--v3-muted)',
              fontSize: 12, fontWeight: tagFilter === t ? 600 : 400, cursor: 'pointer',
              fontFamily: 'var(--v3-font)', whiteSpace: 'nowrap',
              borderBottom: tagFilter === t ? '2px solid var(--v3-primary)' : '2px solid transparent',
            }}>{t}</button>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--v3-bg)' }}>
              <th style={TH}>File</th>
              <th style={TH}>Tag</th>
              <th style={TH}>Client</th>
              <th style={TH}>Size</th>
              <th style={TH}>Uploaded</th>
              <th style={TH}>By</th>
              <th style={{ ...TH, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--v3-soft-line)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--v3-muted)', display: 'inline-flex' }}><V3Icon name="file" size={14} /></span>
                    <span style={{ color: 'var(--v3-ink)', fontWeight: 500 }}>{d.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}><Pill tone={TAG_TONE[d.tag]}>{d.tag}</Pill></td>
                <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{d.client}</td>
                <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{d.size}</td>
                <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{d.uploaded}</td>
                <td style={{ padding: '12px 16px', color: 'var(--v3-muted)' }}>{d.uploader}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--v3-panel)', border: '1px solid var(--v3-line)', borderRadius: 6, fontSize: 11.5, color: 'var(--v3-ink)', cursor: 'pointer', fontFamily: 'var(--v3-font)' }}>
                    <V3Icon name="download" size={12} /> Download
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                  No documents match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
