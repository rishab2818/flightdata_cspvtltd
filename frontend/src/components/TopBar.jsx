import React from 'react'
import { useAuth } from '../context/auth.jsx'

export default function TopBar() {
  const { user, logout } = useAuth()
  return (
    <div className="h-14 flex items-center justify-between px-4 border-b bg-white/70 backdrop-blur-sm">
      <div className="text-lg font-semibold text-[#1976d2]">Welcome!</div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium">{user?.username}</div>
          <div className="text-xs text-gray-500">{user?.role}</div>
        </div>
        <button onClick={logout} className="rounded-md border px-3 py-1 text-sm hover:bg-white">Logout</button>
      </div>
    </div>
  )
}
