"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "@/app/console-theme.module.css";
import {
  formatNotificationRelativeTime,
  NotificationItem,
  notificationCategoryLabel,
} from "@/lib/notifications";

type NotificationsResponse = {
  notifications?: NotificationItem[];
  unreadCount?: number;
  error?: string;
};

function levelClasses(level: NotificationItem["level"]) {
  switch (level) {
    case "SUCCESS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "WARNING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ERROR":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

export function NotificationBell() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const element = wrapperRef.current;
      if (element && !element.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadNotifications = async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/v1/notifications?limit=8", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as NotificationsResponse;

        if (!response.ok) {
          throw new Error(payload.error || "Could not load notifications.");
        }

        if (!active) return;

        setNotifications(
          Array.isArray(payload.notifications) ? payload.notifications : [],
        );
        setUnreadCount(
          typeof payload.unreadCount === "number" ? payload.unreadCount : 0,
        );
        setError(null);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load notifications.",
        );
      } finally {
        if (active && !silent) {
          setLoading(false);
        }
      }
    };

    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications(true);
    }, 60000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function handleMarkRead(notificationId: string, read: boolean) {
    setUpdating(true);

    try {
      const response = await fetch(`/api/v1/notifications/${notificationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ read }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        notification?: NotificationItem;
        error?: string;
      };

      if (!response.ok || !payload.notification) {
        throw new Error(payload.error || "Could not update notification.");
      }

      const updatedNotification = payload.notification;
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? updatedNotification
            : notification,
        ),
      );
      setUnreadCount((current) =>
        read ? Math.max(0, current - 1) : current + 1,
      );
      setError(null);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update notification.",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleMarkAllRead() {
    setUpdating(true);

    try {
      const response = await fetch("/api/v1/notifications/mark-all-read", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        readAt?: string;
        error?: string;
      };

      if (!response.ok || !payload.readAt) {
        throw new Error(payload.error || "Could not mark notifications as read.");
      }

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? payload.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
      setError(null);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not mark notifications as read.",
      );
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div ref={wrapperRef} className={styles.notificationWrap}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.notificationBadge}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className={styles.notificationDropdown}>
          <div className={styles.notificationHeader}>
            <div>
              <p className={styles.notificationTitle}>Notifications</p>
              <p className={styles.notificationSubtitle}>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              className={styles.notificationAction}
              onClick={() => void handleMarkAllRead()}
              disabled={updating || unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          {error ? (
            <div className={styles.notificationError}>{error}</div>
          ) : null}

          {loading ? (
            <div className={styles.notificationState}>Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className={styles.notificationState}>
              No notifications yet.
            </div>
          ) : (
            <div className={styles.notificationList}>
              {notifications.map((notification) => {
                const unread = !notification.readAt;

                return (
                  <article
                    key={notification.id}
                    className={`${styles.notificationItem} ${
                      unread ? styles.notificationItemUnread : ""
                    }`}
                  >
                    <div className={styles.notificationItemBody}>
                      <div className={styles.notificationMeta}>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${levelClasses(
                            notification.level,
                          )}`}
                        >
                          {notificationCategoryLabel(notification.category)}
                        </span>
                        <span className={styles.notificationTime}>
                          {formatNotificationRelativeTime(notification.createdAt)}
                        </span>
                      </div>

                      {notification.href ? (
                        <Link
                          href={notification.href}
                          className={styles.notificationLink}
                          onClick={() => {
                            if (unread) {
                              void handleMarkRead(notification.id, true);
                            }
                          }}
                        >
                          <p className={styles.notificationItemTitle}>
                            {notification.title}
                          </p>
                          <p className={styles.notificationItemMessage}>
                            {notification.message}
                          </p>
                          <span className={styles.notificationItemCta}>
                            {notification.actionLabel ?? "Open"}
                          </span>
                        </Link>
                      ) : (
                        <div>
                          <p className={styles.notificationItemTitle}>
                            {notification.title}
                          </p>
                          <p className={styles.notificationItemMessage}>
                            {notification.message}
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.notificationToggle}
                      onClick={() => void handleMarkRead(notification.id, unread)}
                      disabled={updating}
                    >
                      {unread ? "Mark read" : "Mark unread"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
