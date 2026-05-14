'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type UploadState = { status: 'idle' } | { status: 'uploading'; progress: number; total: number } | { status: 'error'; message: string }

export function ClientDocumentsPage({ docRows }: Props) {
  const router    = useRouter()
  const inputRef  = useRef<HTMLInputElement>(null)
  const [dragging, setDragging]     = useState(false)
  const [upload, setUpload]         = useState<UploadState>({ status: 'idle' })

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.size > 0)
    if (!list.length) return

    setUpload({ status: 'uploading', progress: 0, total: list.length })
    let done = 0
    let failed = 0

    for (const file of list) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', file.name)
      try {
        const res = await fetch('/api/v1/features/documents', { method: 'POST', body: fd })
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(data.error ?? 'Upload failed')
        }
      } catch (e) {
        failed++
        console.error(e)
      }
      done++
      setUpload({ status: 'uploading', progress: done, total: list.length })
    }

    if (failed > 0) {
      setUpload({ status: 'error', message: `${failed} file${failed > 1 ? 's' : ''} failed to upload.` })
    } else {
      setUpload({ status: 'idle' })
    }
    router.refresh()
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() { setDragging(false) }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files)
  }

  const uploading = upload.status === 'uploading'

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.length) void handleFiles(e.target.files); e.target.value = '' }}
      />

      {/* Upload card */}
      <div
        onDragOver={!uploading ? onDragOver : undefined}
        onDragLeave={!uploading ? onDragLeave : undefined}
        onDrop={!uploading ? onDrop : undefined}
        onClick={!uploading ? () => inputRef.current?.click() : undefined}
        style={{ borderRadius: 12, border: `1.5px dashed var(--v3-line)`, padding: 20, background: dragging ? 'var(--v3-primary-soft)' : 'var(--v3-bg)', cursor: uploading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <V3Icon name="upload" size={20} />
            </div>
            <div>
              {uploading ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink)' }}>
                    Uploading {upload.progress} of {upload.total}…
                  </div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: 'var(--v3-line)', width: 220 }}>
                    <div style={{ height: '100%', borderRadius: 4, background: 'var(--v3-primary)', width: `${Math.round((upload.progress / upload.total) * 100)}%`, transition: 'width 0.2s' }} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink)' }}>
                    {dragging ? 'Drop files to upload' : 'Drop files here or click to upload'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>PDF, JPG, PNG, ZIP — up to 50 MB. We auto-tag receipts and licenses.</div>
                </>
              )}
              {upload.status === 'error' && (
                <div style={{ fontSize: 12, color: 'var(--v3-danger)', marginTop: 4 }}>
                  {upload.message}{' '}
                  <button onClick={e => { e.stopPropagation(); setUpload({ status: 'idle' }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textDecoration: 'underline', padding: 0, fontSize: 'inherit' }}>Dismiss</button>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); if (!uploading) inputRef.current?.click() }}
            disabled={uploading}
            style={{ padding: '10px 16px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, flexShrink: 0 }}
          >
            Choose files
          </button>
        </div>
      </div>

      {/* Documents table */}
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
                  No documents uploaded yet. Upload your first file above.
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
                  <a
                    href={`/api/v1/features/documents/${d.id}/download`}
                    download
                    onClick={e => e.stopPropagation()}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--v3-muted)', display: 'grid', placeItems: 'center' }}
                  >
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
