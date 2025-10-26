import React from 'react'
import Icon from './Icon.jsx'
import { useAuth } from '../context/auth.jsx'

export default function Sidebar({ current, setCurrent }) {
  const { canManageUsers } = useAuth()
  const Item = ({ k, icon, label }) => (
    <button
      onClick={() => setCurrent(k)}
      className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm hover:bg-blue-50 ${
        current === k ? 'bg-blue-100 text-[#1976d2]' : 'text-gray-700'
      }`}
    >
      <Icon name={icon} className="h-5 w-5" />
      <span>{label}</span>
    </button>
  )
  return (
    <aside className="w-64 shrink-0 border-r bg-white p-3">
      <div className="flex items-center gap-3 px-2 py-3 mb-2">
        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
          <Icon name="db" />
        </div>
        <div className="font-medium">Data Visualisation</div>
      </div>
      <nav className="space-y-1">
        <Item k="dashboard" icon="db" label="Dashboard" />
        {canManageUsers && <Item k="users" icon="users" label="User Management" />}
        <Item k="settings" icon="gear" label="Setting" />
      </nav>
    </aside>
  )
}
