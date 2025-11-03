import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { AuthContext } from '../context/AuthContext'
import LoginSVG from '../assets/LogIn.svg'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useContext(AuthContext)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault()
    setLoading(true); setError(null)
    try{
      const data = await authApi.login(email, password)
      login(data)
      navigate(data.role === 'ADMIN' ? '/admin' : '/app', { replace:true })
    }catch(e){
      setError('Invalid email or password')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="stage">
      <div className="art">
        <img className="bg" src={LoginSVG} alt="Login artwork" />
        <form className="svg-form" onSubmit={submit}>
          <input className="email" type="email" placeholder="admin@example.com" required
                 value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="password" type="password" placeholder="••••••••" required
                 value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button className="submit" disabled={loading}>{loading ? 'Signing in…' : 'LOGIN'}</button>
        </form>
        {error && <div style={{
          position:'absolute', left:'23%', top:'73%', transform:'translate(0,-50%)',
          padding:'8px 10px', background:'#fee2e2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius:10
        }}>{error}</div>}
      </div>
    </div>
  )
}
