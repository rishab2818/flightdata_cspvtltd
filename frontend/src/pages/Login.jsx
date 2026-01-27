import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { AuthContext } from '../context/AuthContext'
import Vector from '../assets/Vector.png'
import Airplane1 from '../assets/Airplane1.svg'
import Database from '../assets/Database.svg'
import ViewIcon from '../assets/ViewIcon.svg'
import EyeSlash from '../assets/EyeSlash.svg'

import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // ✅ added
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { login } = useContext(AuthContext)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.login(email, password)
      login(data)
      navigate(data.role === 'ADMIN' ? '/admin' : '/app', { replace: true })
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div class="login-content">

        {/* LEFT */}
        <div className="login-left">
          <div className="brand">
            <img src={Database} alt="db" />
            <span>Data Visualisation</span>
          </div>

          <h2>Login</h2>
          <p className="subtitle">How do I get started?</p>

          <form onSubmit={submit}>
            <label>User Name</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>
            <div className="password-box">
              <input
                type={showPassword ? 'text' : 'password'}  // ✅ toggle
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <img
  src={showPassword ? EyeSlash : ViewIcon}
  alt={showPassword ? "hide password" : "show password"}
  onClick={() => setShowPassword(prev => !prev)}
  style={{ cursor: 'pointer' }}
/>


              {/* <img
                src={ViewIcon}
                alt="view"
                onClick={() => setShowPassword(!showPassword)} // ✅ click
                style={{ cursor: 'pointer' }}
              /> */}
            </div>

            <button disabled={loading}>
              {loading ? 'Signing in…' : 'LOGIN'}
            </button>
          </form>

          {error && <div className="error">{error}</div>}
        </div>

        {/* RIGHT */}
        <div className="login-right">
          <img className="vector" src={Vector} alt="vector" />
          <img className="plane" src={Airplane1} alt="airplane" />
        </div>
        </div>

      </div>
    </div>
  )
}
