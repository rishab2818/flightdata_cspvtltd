import React, { useEffect, useRef, useState } from 'react'
import { IoNotificationsOutline } from 'react-icons/io5'
import { useNotifications } from '../../context/NotificationContext'
import { formatDistanceToNow } from '../../lib/time'

export default function NotificationBell() {
  const { notifications = [], unreadCount, markAsRead, markAllAsRead, refresh, loading } = useNotifications()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const toggleOpen = () => setOpen((v) => !v)

  const sorted = notifications.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div className="notification" ref={menuRef}>
      <button type="button" className="notification__button" aria-label="Notifications" onClick={toggleOpen}>
        <IoNotificationsOutline size={22} />
        {unreadCount ? <span className="notification__badge">{unreadCount}</span> : null}
      </button>

      {open && (
        <div className="notification__panel">
          <div className="notification__header">
            <div>
              <div className="notification__title">Notifications</div>
              <div className="notification__meta">
                {loading ? 'Refreshing…' : `${unreadCount || 0} unread`}
              </div>
            </div>
            <button type="button" className="notification__link" onClick={markAllAsRead}>
              Mark all as read
            </button>
          </div>

          <div className="notification__list">
            {sorted.length === 0 ? (
              <div className="notification__empty">No notifications yet</div>
            ) : (
              sorted.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markAsRead(item.id)}
                  className={`notification__item ${item.is_read || item.isRead ? '' : 'notification__item--unread'}`}
                >
                  <div className="notification__item-title">{item.title || item.category || 'Update'}</div>
                  <div className="notification__item-message">{item.message}</div>
                  <div className="notification__item-time">{formatDistanceToNow(item.created_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
