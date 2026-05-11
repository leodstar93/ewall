'use client'

import { Card } from '@/app/v3/components/ui/Card'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import type { IconName } from '@/app/v3/components/ui/V3Icon'

interface Props { userName?: string }

const TOPICS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'fuel',    title: 'IFTA quarter walkthrough',  desc: 'How to upload mileage and fuel for the quarter.' },
  { icon: 'shield',  title: 'UCR registration help',     desc: 'What bracket you fall in and what it costs.' },
  { icon: 'receipt', title: 'Form 2290 questions',       desc: 'Mid-year additions, suspended vehicles, refunds.' },
  { icon: 'pin',     title: 'DMV renewals by state',     desc: 'TX, CA, AZ, FL, NM, LA processes.' },
  { icon: 'file',    title: 'Uploading documents',       desc: 'What we accept and how OCR works.' },
  { icon: 'users',   title: 'Adding drivers',            desc: 'CDL upload, MVR pull, drug-test linking.' },
]

const CONVOS = [
  { from: 'Ana (Ewall ops)',  subj: 'Re: 2 receipts on IFTA Q2', when: '2 hr ago',  unread: true },
  { from: 'Carlos (Ewall ops)',subj: 'TRK-309 maintenance receipt', when: 'Apr 28',  unread: false },
  { from: 'Ewall billing',    subj: 'May invoice ready',           when: 'May 02',  unread: false },
]

export function ClientSupportPage({ userName: _ }: Props) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero */}
      <Card style={{ background: 'var(--v3-primary)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ color: '#fff' }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: -0.3 }}>¿Cómo te ayudamos hoy?</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>Bilingual ops team · weekdays 7am–7pm CT · avg response under 4 minutes.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={{ padding: '10px 14px', background: 'var(--v3-accent)', color: '#0E1116', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Start chat</button>
            <button style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Schedule call</button>
          </div>
        </div>
      </Card>

      {/* Common topics */}
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 12, letterSpacing: -0.2 }}>Common topics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {TOPICS.map((t, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--v3-primary-soft)', color: 'var(--v3-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <V3Icon name={t.icon} size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{t.desc}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Conversations */}
      <Card>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 14 }}>Your conversations</div>
        {CONVOS.map((c, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: i < CONVOS.length - 1 ? '1px solid var(--v3-soft-line)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {c.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--v3-danger)', display: 'block', flexShrink: 0 }} />}
              {!c.unread && <span style={{ width: 7, flexShrink: 0 }} />}
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', fontWeight: c.unread ? 600 : 500 }}>{c.subj}</div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>From {c.from}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--v3-muted)', flexShrink: 0 }}>{c.when}</div>
          </div>
        ))}
      </Card>
    </div>
  )
}
