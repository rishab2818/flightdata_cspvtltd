import React from 'react'

export default function TextInput({ label, type = 'text', value, onChange, placeholder, rightIcon }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-600">{label}</label>
      <div className="relative">
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {rightIcon && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer select-none">{rightIcon}</div>
        )}
      </div>
    </div>
  )
}
