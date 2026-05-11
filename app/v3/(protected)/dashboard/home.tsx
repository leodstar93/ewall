'use client'

import { Fragment } from 'react'
import { Card } from '@/app/v3/components/ui/Card'
import { Pill } from '@/app/v3/components/ui/Pill'
import type { PillTone } from '@/app/v3/components/ui/Pill'
import { V3Icon } from '@/app/v3/components/ui/V3Icon'
import styles from './home.module.css'

interface Props { userName?: string }

const STAGES = ['Documents', 'Pay', 'Filing', 'Review', 'Approved']

const ACTIONS = [
  { kind: 'Pay',    urgency: 'danger' as const, title: 'Pay UCR 2026 fee',       sub: '$525 · due in 12 days',            cta: 'Pay now' },
  { kind: 'Sign',   urgency: 'warn'   as const, title: 'Sign IFTA Q2 review',     sub: 'Ana from Ewall flagged 2 receipts', cta: 'Review' },
  { kind: 'Upload', urgency: 'info'   as const, title: 'Send Apr fuel receipts',  sub: 'Needed for Q2 IFTA close',         cta: 'Upload' },
]

const FILINGS: { kind: string; label: string; stage: number; status: string; tone: PillTone; sub: string }[] = [
  { kind: 'IFTA', label: 'IFTA · 2026 Q2',      stage: 2, status: 'In review by Ewall',    tone: 'warn',    sub: 'Submitted Apr 30 · Estimated close May 12' },
  { kind: 'UCR',  label: 'UCR · 2026',           stage: 1, status: 'Awaiting your payment', tone: 'danger',  sub: '$525 · pay to start filing' },
  { kind: '2290', label: 'Form 2290 · FY 2026',  stage: 4, status: 'Approved',              tone: 'success', sub: 'Schedule 1 stamped Apr 02' },
]

const FLEET_PREVIEW = [
  { id: 'TRK-101', model: 'Freightliner Cascadia', driver: 'José Rivera',    loc: 'Dallas, TX → Houston',   tone: 'success' as PillTone, status: 'In transit' },
  { id: 'TRK-214', model: 'Volvo VNL 760',         driver: 'Ana Morales',    loc: 'Phoenix, AZ',            tone: 'success' as PillTone, status: 'In transit' },
  { id: 'TRK-309', model: 'Kenworth T680',          driver: 'Luis Martínez',  loc: 'San Bernardino, CA',     tone: 'warn'    as PillTone, status: 'Maintenance' },
  { id: 'TRK-411', model: 'Peterbilt 579',          driver: 'Marcos Díaz',    loc: 'Laredo, TX',             tone: 'success' as PillTone, status: 'Active' },
  { id: 'TRK-550', model: 'International LT',       driver: 'Unassigned',     loc: 'Miami, FL · Yard',       tone: 'neutral' as PillTone, status: 'Idle' },
]

const UPDATES = [
  { who: 'Ana (Ewall ops)',     what: 'flagged 2 receipts on Q2 IFTA',               when: '2 hr ago',  icon: 'fuel'  as const, tone: 'warn'    as const },
  { who: 'System',              what: 'reminded you UCR 2026 fee is due May 19',     when: 'Yesterday', icon: 'shield'as const, tone: 'info'    as const },
  { who: 'IRS',                 what: 'stamped your Schedule 1 for FY 2026',         when: 'Apr 02',    icon: 'check' as const, tone: 'success' as const },
  { who: 'Carlos (Ewall ops)',  what: 'asked about TRK-309 maintenance receipt',     when: 'Apr 28',    icon: 'file'  as const, tone: undefined },
]

function urgencyColor(u: 'danger' | 'warn' | 'info') {
  return u === 'danger' ? 'var(--v3-danger)' : u === 'warn' ? 'var(--v3-warn)' : 'var(--v3-info)'
}
function urgencyBg(u: 'danger' | 'warn' | 'info') {
  return u === 'danger' ? 'var(--v3-danger-bg)' : u === 'warn' ? 'var(--v3-warn-bg)' : 'var(--v3-info-bg)'
}

export function ClientHomePage({ userName }: Props) {
  const firstName = userName?.split(' ')[0] ?? 'there'

  return (
    <div className={styles.page}>
      {/* Welcome hero */}
      <Card noPadding style={{ overflow: 'hidden' }}>
        <div style={{ background: 'var(--v3-primary)', color: '#fff', padding: '24px 28px', position: 'relative' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(181,137,90,0.15)', filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11.5, opacity: 0.7, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>Friday · May 9, 2026</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, letterSpacing: -0.4 }}>
                Hola, {firstName}.{' '}
                <span style={{ opacity: 0.7 }}>You have 3 things to handle this week.</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Rivera Trans LLC · USDOT 2845109 · MC-840221</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 28, alignItems: 'center' }}>
              {[{ l: 'Trucks', v: '8' }, { l: 'On road now', v: '5' }, { l: 'Open to-dos', v: '3' }].map(s => (
                <div key={s.l}>
                  <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, letterSpacing: -0.5 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Action items */}
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 12, letterSpacing: -0.2 }}>What needs you today</div>
        <div className={styles.actionsGrid}>
          {ACTIONS.map((a, i) => (
            <Card key={i} style={{ borderLeft: `3px solid ${urgencyColor(a.urgency)}` }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: urgencyColor(a.urgency), background: urgencyBg(a.urgency), padding: '2px 7px', borderRadius: 5 }}>
                {a.kind}
              </span>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', marginTop: 12, letterSpacing: -0.2 }}>{a.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--v3-muted)', marginTop: 4, lineHeight: 1.5 }}>{a.sub}</div>
              <button style={{ marginTop: 14, padding: '8px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {a.cta} <V3Icon name="arrow" size={12} />
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Filings stepper */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--v3-ink)', letterSpacing: -0.2 }}>Your filings</div>
            <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Live status from Ewall&apos;s filing team</div>
          </div>
          <button style={{ fontSize: 12, color: 'var(--v3-ink)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            See all <V3Icon name="arrow" size={11} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {FILINGS.map(f => (
            <div key={f.kind} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px', gap: 18, alignItems: 'center', paddingBottom: 18, borderBottom: '1px solid var(--v3-soft-line)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>{f.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 3 }}>{f.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {STAGES.map((s, i) => {
                  const done = i < f.stage
                  const here = i === f.stage
                  const c = done
                    ? 'var(--v3-success)'
                    : here
                      ? f.tone === 'danger' ? 'var(--v3-danger)' : f.tone === 'warn' ? 'var(--v3-warn)' : 'var(--v3-primary)'
                      : 'var(--v3-soft-line)'
                  return (
                    <Fragment key={s}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: done || here ? c : 'transparent', border: `2px solid ${c}`, display: 'grid', placeItems: 'center', color: '#fff' }}>
                          {done
                            ? <V3Icon name="check" size={11} />
                            : here
                              ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block' }} />
                              : null}
                        </div>
                        <div style={{ fontSize: 10.5, color: done || here ? 'var(--v3-ink)' : 'var(--v3-muted)', fontWeight: here ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</div>
                      </div>
                      {i < STAGES.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: i < f.stage ? 'var(--v3-success)' : 'var(--v3-soft-line)', marginTop: -16 }} />
                      )}
                    </Fragment>
                  )
                })}
              </div>
              <div style={{ textAlign: 'right' }}>
                <Pill tone={f.tone}>{f.status}</Pill>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Fleet preview + Updates */}
      <div className={styles.lower}>
        <Card noPadding>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--v3-soft-line)' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)' }}>My fleet</div>
              <div style={{ fontSize: 11.5, color: 'var(--v3-muted)', marginTop: 2 }}>5 of 8 on the road right now</div>
            </div>
            <button style={{ fontSize: 12, color: 'var(--v3-ink)', background: 'transparent', border: '1px solid var(--v3-line)', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>+ Add truck</button>
          </div>
          {FLEET_PREVIEW.map(t => (
            <div key={t.id} style={{ padding: '13px 20px', borderBottom: '1px solid var(--v3-soft-line)', display: 'grid', gridTemplateColumns: '110px 1fr 1fr 110px', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--v3-ink)' }}>{t.id}</div>
                <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 1 }}>{t.model}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--v3-ink)' }}>{t.driver}</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <V3Icon name="pin" size={12} />{t.loc}
              </div>
              <div style={{ textAlign: 'right' }}><Pill tone={t.tone}>{t.status}</Pill></div>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v3-ink)', marginBottom: 14 }}>Updates from Ewall</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {UPDATES.map((a, i) => {
              const iconBg    = a.tone === 'success' ? 'var(--v3-success-bg)' : a.tone === 'warn' ? 'var(--v3-warn-bg)' : a.tone === 'info' ? 'var(--v3-info-bg)' : 'var(--v3-primary-soft)'
              const iconColor = a.tone === 'success' ? 'var(--v3-success)'    : a.tone === 'warn' ? 'var(--v3-warn)'    : a.tone === 'info' ? 'var(--v3-info)'    : 'var(--v3-primary)'
              return (
                <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, color: iconColor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <V3Icon name={a.icon} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--v3-ink)', lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 500 }}>{a.who}</span>{' '}
                      <span style={{ color: 'var(--v3-muted)' }}>{a.what}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--v3-muted)', marginTop: 2 }}>{a.when}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Help band */}
      <Card style={{ background: 'var(--v3-primary-soft)', borderColor: 'var(--v3-primary-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--v3-primary)', color: '#fff', display: 'grid', placeItems: 'center' }}>
              <V3Icon name="sparkle" size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v3-ink)' }}>¿Necesitas ayuda? Talk to a real person.</div>
              <div style={{ fontSize: 12, color: 'var(--v3-muted)', marginTop: 3 }}>Our bilingual team is on call weekdays 7am–7pm CT. Avg response under 4 minutes.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '9px 14px', background: 'var(--v3-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Start chat</button>
            <button style={{ padding: '9px 14px', background: 'var(--v3-panel)', color: 'var(--v3-ink)', border: '1px solid var(--v3-line)', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Call us</button>
          </div>
        </div>
      </Card>
    </div>
  )
}
