import React, { useState } from 'react'

export default function LoginForm({ onSubmit, loading }){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handle = (e)=>{ e.preventDefault(); onSubmit?.({ email, password }) }

  return (
    <form onSubmit={handle}>
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" placeholder="admin@example.com" required
          value={email} onChange={(e)=>setEmail(e.target.value)} />
      </div>

      <div className="field">
        <label>Password</label>
        <input className="input" type="password" placeholder="••••••••" required
          value={password} onChange={(e)=>setPassword(e.target.value)} />
      </div>

      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
