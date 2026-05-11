'use client'

import { useState, useRef, useEffect } from 'react'
import { V3Icon } from '../ui/V3Icon'
import styles from './Topbar.module.css'

interface TopbarProps {
  title: string
  breadcrumb?: string[]
}

const NOTIFICATIONS = [
  {
    id: 1, read: false,
    tag: 'IFTA', tagTone: 'warn' as const,
    title: '2 fuel receipts flagged on Q2 IFTA',
    body: 'Apr receipts for TRK-309 and TRK-411 are missing.',
    time: '2 hr ago',
    icon: 'fuel' as const,
  },
  {
    id: 2, read: false,
    tag: 'DMV', tagTone: 'danger' as const,
    title: '7 TX registrations expire May 18',
    body: 'Bulk renewal needed before the deadline.',
    time: '5 hr ago',
    icon: 'pin' as const,
  },
  {
    id: 3, read: false,
    tag: 'UCR', tagTone: 'info' as const,
    title: 'UCR 2026 fee payment pending',
    body: '$525 due — awaiting customer payment.',
    time: 'Yesterday',
    icon: 'shield' as const,
  },
  {
    id: 4, read: true,
    tag: '2290', tagTone: 'success' as const,
    title: 'Schedule 1 stamped for FY 2026',
    body: 'IRS approved. Ready to download.',
    time: 'Apr 02',
    icon: 'receipt' as const,
  },
  {
    id: 5, read: true,
    tag: 'Docs', tagTone: 'neutral' as const,
    title: 'New document uploaded by client',
    body: 'Rivera Trans LLC added insurance certificate.',
    time: 'Apr 28',
    icon: 'file' as const,
  },
  {
    id: 6, read: true,
    tag: 'System', tagTone: 'neutral' as const,
    title: 'IFTA tax rates updated for Q2 2026',
    body: 'Auto-synced from IFTA, Inc. on May 04.',
    time: 'May 04',
    icon: 'sparkle' as const,
  },
]

const TAG_COLORS: Record<string, [string, string]> = {
  warn:    ['var(--v3-warn-bg)',    'var(--v3-warn)'],
  danger:  ['var(--v3-danger-bg)', 'var(--v3-danger)'],
  info:    ['var(--v3-info-bg)',   'var(--v3-info)'],
  success: ['var(--v3-success-bg)','var(--v3-success)'],
  neutral: ['var(--v3-chip-bg)',   'var(--v3-muted)'],
}

export function Topbar({ title, breadcrumb }: TopbarProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(NOTIFICATIONS)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notes.filter(n => !n.read).length

  function markAllRead() {
    setNotes(prev => prev.map(n => ({ ...n, read: true })))
  }

  function markRead(id: number) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className={styles.breadcrumbItem}>
                {i > 0 && <span className={styles.sep} aria-hidden>/</span>}
                <span className={i === breadcrumb.length - 1 ? styles.crumbActive : styles.crumb}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} type="button" aria-label="Search">
          <V3Icon name="search" size={16} />
        </button>

        <div ref={ref} className={styles.bellWrapper}>
          <button
            className={styles.iconBtn}
            type="button"
            aria-label="Notifications"
            onClick={() => setOpen(v => !v)}
          >
            <V3Icon name="bell" size={16} />
            {unread > 0 && (
              <span className={styles.badgeDot} aria-hidden />
            )}
          </button>

          {open && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <div className={styles.dropdownTitle}>
                  Notifications
                  {unread > 0 && (
                    <span className={styles.unreadChip}>{unread} new</span>
                  )}
                </div>
                {unread > 0 && (
                  <button className={styles.markAllBtn} onClick={markAllRead} type="button">
                    Mark all read
                  </button>
                )}
              </div>

              <div className={styles.noteList}>
                {notes.map(n => {
                  const [tagBg, tagColor] = TAG_COLORS[n.tagTone]
                  return (
                    <button
                      key={n.id}
                      className={styles.noteItem}
                      data-unread={!n.read}
                      onClick={() => markRead(n.id)}
                      type="button"
                    >
                      <div
                        className={styles.noteIcon}
                        style={{ background: tagBg, color: tagColor }}
                      >
                        <V3Icon name={n.icon} size={14} />
                      </div>
                      <div className={styles.noteBody}>
                        <div className={styles.noteMeta}>
                          <span className={styles.noteTag} style={{ background: tagBg, color: tagColor }}>
                            {n.tag}
                          </span>
                          <span className={styles.noteTime}>{n.time}</span>
                          {!n.read && <span className={styles.unreadDot} aria-hidden />}
                        </div>
                        <div className={styles.noteTitle}>{n.title}</div>
                        <div className={styles.noteText}>{n.body}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className={styles.dropdownFooter}>
                <button className={styles.viewAllBtn} type="button">
                  View all notifications <V3Icon name="arrow" size={11} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
