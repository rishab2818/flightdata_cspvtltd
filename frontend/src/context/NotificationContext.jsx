import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { notificationsApi } from '../api/notificationsApi'
import { AuthContext } from './AuthContext'

export const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([])
      return
    }
    try {
      setLoading(true)
      const data = await notificationsApi.list(50)
      setNotifications(data || [])
    } catch (err) {
      console.error('Failed to load notifications', err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    refresh()
    if (!isAuthenticated) return undefined
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [isAuthenticated, refresh])

  const markAsRead = useCallback(
    async (notificationId) => {
      try {
        await notificationsApi.markAsRead(notificationId)
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      } catch (err) {
        console.error('Failed to mark notification as read', err)
      }
    },
    [],
  )

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead()
      setNotifications([])
    } catch (err) {
      console.error('Failed to mark all notifications as read', err)
    }
  }, [])

  const unreadCount = useMemo(
    () =>
      notifications.filter((n) => {
        if (n.is_read === false || n.isRead === false) return true
        if (n.is_read === undefined && n.isRead !== true) return true
        return false
      }).length,
    [notifications],
  )

  const value = useMemo(
    () => ({ notifications, loading, unreadCount, refresh, markAsRead, markAllAsRead }),
    [notifications, loading, unreadCount, refresh, markAsRead, markAllAsRead],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  return useContext(NotificationContext)
}
