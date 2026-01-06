import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { storage } from '../lib/storage'
import { getExpiryMs } from '../lib/jwt'
import { attachUnauthorizedHandler } from '../lib/axiosClient'

export const AuthContext = createContext(null)

export function AuthProvider({ children }){
  const [auth, setAuth] = useState(()=>{
    const token = storage.getToken()
    const user  = storage.getUser()
    return token && user ? { token, user } : { token:null, user:null }
  })

  const timerRef = useRef(null)
  const clearTimer = () => { if(timerRef.current){ clearTimeout(timerRef.current); timerRef.current=null } }

  const logout = useCallback(()=>{
    clearTimer(); storage.clear(); setAuth({ token:null, user:null })
  }, [])

  const scheduleLogout = useCallback((token)=>{
    clearTimer()
    const expMs = getExpiryMs(token)
    if(!expMs) return
    const delay = Math.max(0, expMs - Date.now()) + 1000
    timerRef.current = setTimeout(logout, delay)
  }, [logout])

  const login = useCallback((payload)=>{
    const token = payload.access_token
    const user = {
      email: payload.email,
      role: payload.role,
      accessLevel: payload.access_level_value,
      tokenType: payload.token_type || 'bearer',
    }
    storage.setToken(token); storage.setUser(user)
    setAuth({ token, user }); scheduleLogout(token)
  }, [scheduleLogout])

  useEffect(()=>{ if(auth.token) scheduleLogout(auth.token) }, [])
  useEffect(()=>{ attachUnauthorizedHandler(()=>logout()) }, [logout])

  const value = useMemo(()=> ({
    token: auth.token,
    user: auth.user,
    isAuthenticated: !!auth.token,
    isAdmin: auth.user?.role === 'ADMIN',
    login, logout
  }), [auth, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
