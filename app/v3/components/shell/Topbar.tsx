'use client'

import { useState, useRef, useEffect } from 'react'
import { V3Icon } from '../ui/V3Icon'
import type { IconName } from '../ui/V3Icon'
import type { NotificationItem } from '@/lib/notifications'
import { notificationCategoryLabel, formatNotificationRelativeTime } from '@/lib/notifications'
import styles from './Topbar.module.css'

export type { NotificationItem }

type TagTone = 'warn' | 'danger' | 'info' | 'success' | 'neutral'

const CATEGORY_ICON: Record<string, IconName> = {
  IFTA:      'fuel',
  UCR:       'shield',
  FORM2290:  'receipt',
  DMV:       'pin',
  DOCUMENTS: 'file',
  ACCOUNT:   'users',
  SYSTEM:    'sparkle',
}

const CATEGORY_BASE_TONE: Record<string, TagTone> = {
  IFTA:      'info',
  UCR:       'info',
  FORM2290:  'neutral',
  DMV:       'warn',
  DOCUMENTS: 'neutral',
  ACCOUNT:   'info',
  SYSTEM:    'neutral',
}

const TAG_COLORS: Record<TagTone, [string, string]> = {
  warn:    ['var(--v3-warn-bg)',    'var(--v3-warn)'],
  danger:  ['var(--v3-danger-bg)', 'var(--v3-danger)'],
  info:    ['var(--v3-info-bg)',   'var(--v3-info)'],
  success: ['var(--v3-success-bg)','var(--v3-success)'],
  neutral: ['var(--v3-chip-bg)',   'var(--v3-muted)'],
}

function deriveTone(level: string, category: string): TagTone {
  if (level === 'ERROR') return 'danger'
  if (level === 'WARNING') return 'warn'
  if (level === 'SUCCESS') return 'success'
  return CATEGORY_BASE_TONE[category] ?? 'neutral'
}

interface TopbarProps {
  title: string
  breadcrumb?: string[]
  initialNotifications?: NotificationItem[]
}

export function Topbar({ title, breadcrumb, initialNotifications = [] }: TopbarProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(initialNotifications)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notes.filter(n => !n.readAt).length

  async function markRead(id: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    setNotes(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? now })))
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
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
                {notes.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: 13 }}>
                    No notifications yet.
                  </div>
                )}
                {notes.map(n => {
                  const tone = deriveTone(n.level, n.category)
                  const [tagBg, tagColor] = TAG_COLORS[tone]
                  const icon = CATEGORY_ICON[n.category] ?? 'bell'
                  const tag = notificationCategoryLabel(n.category)
                  const time = formatNotificationRelativeTime(n.createdAt)
                  return (
                    <button
                      key={n.id}
                      className={styles.noteItem}
                      data-unread={!n.readAt}
                      onClick={() => markRead(n.id)}
                      type="button"
                    >
                      <div
                        className={styles.noteIcon}
                        style={{ background: tagBg, color: tagColor }}
                      >
                        <V3Icon name={icon} size={14} />
                      </div>
                      <div className={styles.noteBody}>
                        <div className={styles.noteMeta}>
                          <span className={styles.noteTag} style={{ background: tagBg, color: tagColor }}>
                            {tag}
                          </span>
                          <span className={styles.noteTime}>{time}</span>
                          {!n.readAt && <span className={styles.unreadDot} aria-hidden />}
                        </div>
                        <div className={styles.noteTitle}>{n.title}</div>
                        <div className={styles.noteText}>{n.message}</div>
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
