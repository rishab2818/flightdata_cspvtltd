import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdKeyboardArrowDown } from 'react-icons/md'
import { AuthContext } from '../../context/AuthContext'
import NotificationBell from './NotificationBell'
import Ellipse49 from "../../assets/Ellipse49.svg"

export default function TopBarActions() {
  const { user, logout } = useContext(AuthContext)
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // const userId =  user?.username ||user?.name || user?.email || 'User'
  const userId = user?.username || ''
  // const roleLabel = user?.role || ''

  return (
    <div className="header__actions" ref={menuRef}>
      <NotificationBell />
      <div className="header__profile">
        <div className="header__avatar">
        <img src={Ellipse49} alt="" />
        </div>

        <div className="header__info">
          <span className="header__name">{userId}</span>
          {/* <span className="header__role">{roleLabel}</span> */}
        </div>
        <button
          type="button"
          className="header__toggle"
          aria-label="Open user menu"
          onClick={() => setOpen((v) => !v)}
        >
          <MdKeyboardArrowDown size={22} />
        </button>
      </div>

      {open && (
        <div className="header__menu">
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
