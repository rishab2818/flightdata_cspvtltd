import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import BellSimple from "../../assets/BellSimple.svg";
import { formatDistanceToNowWithExactTime } from '../../lib/time';


export default function NotificationBell() {
  const { notifications = [], unreadCount, markAsRead, markAllAsRead, refresh, loading } = useNotifications();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close notification panel when clicking outside
  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Refresh notifications when panel is opened
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const toggleOpen = () => setOpen((v) => !v);

  // Sort notifications by newest first
  const sorted = notifications.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Helper to format UTC timestamps to local time
  const formatToLocalTime = (utcString) => {
    if (!utcString) return '';
    const date = new Date(utcString); // parse UTC timestamp
    if (isNaN(date.getTime())) return '';

    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true, // set false for 24-hour format
    });
  };

  return (
    <div className="notification" ref={menuRef}>
      {/* Notification button */}
      <button
        type="button"
        className="notification-btn"
        aria-label="Notifications"
        onClick={toggleOpen}
      >
        <span className="bell-container">
          <img src={BellSimple} alt="bell" />
          {unreadCount > 0 && (
            <span className="Badge">{unreadCount}</span>
          )}
        </span>
      </button>

      {/* Notification panel */}
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
                  {/* <div className="notification__item-time">
                    {formatToLocalTime(item.created_at)}
                  </div> */}
                  <p className="notification-time">
  {formatDistanceToNowWithExactTime(item.created_at)}
</p>

                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
