import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MdKeyboardArrowDown } from 'react-icons/md'
import { AuthContext } from '../../context/AuthContext'
import NotificationBell from './NotificationBell'
import Ellipse49 from "../../assets/Ellipse49.svg"

export default function TopBarActions() {
  const { user, logout } = useContext(AuthContext)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  

  const menuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="header__actions" ref={menuRef}>

      {/* 🔍 Search */}
      {/* <div className="header__search">
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setShowResults(true)}
        />

        {showResults && results.length > 0 && (
          <div className="search__dropdown">
            {results.map((file) => (
              <div
                key={file.id}
                className="search__item"
                onClick={() => window.open(file.download_url, "_blank")}
              >
                <div className="file-name">{file.name}</div>
                <div className="file-section">{file.section}</div>
              </div>
            ))}
          </div>
        )}
      </div> */}

      {!isAdminRoute && <NotificationBell />}

      {/* Profile */}
      <div className="header__profile">
        {/* <div className="header__avatar">
          <img src={Ellipse49} alt="" />
        </div> */}
        <div className="admin-avatar">{user?.username.charAt(0).toUpperCase()}</div>
        
        <div className="header__info">
          <span className="header__name">{user?.username || ''}</span>
        </div>

        <button
          type="button"
          className="header__toggle"
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