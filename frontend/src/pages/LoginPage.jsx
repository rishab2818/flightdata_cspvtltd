import React, { useState, useEffect } from 'react'        // 👈 add useEffect
import TextInput from '../components/TextInput.jsx'
import { useAuth } from '../context/auth'
import { useNavigate } from 'react-router-dom'             // 👈 add navigate

export default function LoginPage() {
  
  const { login, authLoading, authError,user  } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [show, setShow] = useState(false);
 const navigate = useNavigate();                              // 👈 init navigate
  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
    } catch (_) {
      // error already in context, ignore here
    }
  };
    useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);



  return (
    <div className="min-h-screen bg-[#1976d2] flex items-center justify-center p-6">
      <div className="mx-auto w-full max-w-6xl rounded-2xl bg-white shadow-xl p-10 md:p-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            {/* header + logo unchanged */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-6 w-6">
                  <ellipse cx="12" cy="6" rx="7" ry="3" fill="#1976d2" opacity="0.2" />
                  <ellipse cx="12" cy="10" rx="7" ry="3" fill="#1976d2" opacity="0.35" />
                  <ellipse cx="12" cy="14" rx="7" ry="3" fill="#1976d2" />
                </svg>
              </div>
              <div className="font-medium text-gray-800">Data Visualisation</div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900">Login</h2>
            <p className="text-sm text-gray-500 mb-6">How do I get started ?</p>

            <form onSubmit={submit} className="space-y-4">
              <TextInput label="User Name" value={username} onChange={setUsername} placeholder="Enter username" />
              <TextInput
                label="Password"
                value={password}
                onChange={setPassword}
                type={show ? "text" : "password"}
                rightIcon={
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label="toggle password">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-500">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                  </button>
                }
              />

              {authError && (
                <div className="text-sm text-red-600">Login failed: {authError}</div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-40 rounded-md bg-[#1976d2] py-2 text-white text-sm font-medium hover:brightness-110 active:brightness-95 disabled:opacity-60"
              >
                {authLoading ? "Signing in..." : "LOGIN"}
              </button>
            </form>
          </div>

          {/* Right side SVG unchanged */}
          <div className="hidden md:block">
            <svg viewBox="0 0 500 220" className="w-full">
              <path d="M10 170 C 60 80, 120 40, 170 120 S 260 180, 300 120 370 40, 420 120 470 160, 490 120" fill="none" stroke="#1976d2" strokeWidth="3" />
              <g transform="translate(455,110) rotate(15)">
                <path d="M0 0 L20 10 L0 20 L5 12 L-15 12 L-15 8 L5 8 Z" fill="#1976d2" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}