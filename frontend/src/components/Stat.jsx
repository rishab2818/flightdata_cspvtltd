import React from 'react'
import Icon from './Icon.jsx'

export default function Stat({ title, value, icon }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border">
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div className="flex items-center gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        <Icon name={icon} />
      </div>
    </div>
  )
}
