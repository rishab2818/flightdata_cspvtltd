import React, { useMemo, useState } from 'react';
import {
  Card, CardContent, Box, TextField, MenuItem,
  Button, Alert, InputAdornment, IconButton
} from '@mui/material';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import { usersApi } from '../../api/usersApi';
import styles from './CreateUserCard.module.css';
import newusericon from '../../assets/UserPlus.svg'
// Friendly label -> enum value shown by you
const ROLE_OPTIONS = [
  { label: 'Administrator',     value: 'ADMIN'   },
  { label: 'Group Director',    value: 'GD'      },
  { label: 'Division Head',     value: 'DH'      },
  { label: 'Team Lead',         value: 'TL'      },
  { label: 'System Manager',    value: 'SM'      },
  { label: 'Officer in Charge', value: 'OIC'     },
  { label: 'Junior Research Fellow', value: 'JRF' },
  { label: 'Senior Research Fellow', value: 'SRF' },
  { label: 'Contract Engineer', value: 'CE'      },
  { label: 'Student',           value: 'STUDENT' },
];

function splitName(full) {
  const s = (full || '').trim().replace(/\s+/g, ' ');
  if (!s) return { first: '', last: '' };
  const parts = s.split(' ');
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export default function CreateUserCard({ onCreated }) {
  const [userName, setUserName] = useState('');          // single field (matches your mock)
  const [role, setRole]         = useState('DH');        // default like “Division Head” from screenshot
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);

  const [loading, setLoading] = useState(false);
  const [ok, setOk]           = useState('');
  const [err, setErr]         = useState('');

  const canSubmit = useMemo(() =>
    userName.trim() && email.trim() && password.trim() && role, [userName, email, password, role]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true); setOk(''); setErr('');
    const { first, last } = splitName(userName);
    try {
      await usersApi.create({
        first_name: first,
        last_name:  last || undefined,
        email:      email.trim(),
        password,
        role,
        is_active: true,
      });
      setOk('User created');
      setUserName(''); setEmail(''); setPassword(''); setRole('DH');
      onCreated?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setErr(detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={styles.card}>
      <CardContent className={styles.body}>
        {/* Title */}
<div className={styles.header}>
  <img 
    src={newusericon} 
    alt="Create new user icon" 
    style={{ width: 32, height: 32, transform: 'rotate(0deg)', opacity: 1 }} 
  />
  <div className={styles.headerTitle}>Create new user</div>
</div>

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} className={styles.form}>
          {err && <Alert severity="error" className={styles.alert}>{err}</Alert>}
          {ok  && <Alert severity="success" className={styles.alert}>{ok}</Alert>}

          {/* User Name */}
          <div>
            <div className={styles.fieldLabel}>User Name</div>
            <TextField
              fullWidth size="medium" placeholder="John Doe"
              value={userName} onChange={(e) => setUserName(e.target.value)}
              inputProps={{ maxLength: 80 }}
            />
          </div>

          {/* Role */}
          <div>
            <div className={styles.fieldLabel}>Role</div>
            <TextField
              fullWidth size="medium" select value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLE_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
          </div>

          {/* Login ID (Email) */}
          <div>
            <div className={styles.fieldLabel}>Login ID</div>
            <TextField
              fullWidth size="medium" type="email" placeholder="admin@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <div className={styles.fieldLabel}>Password</div>
            <TextField
              fullWidth size="medium"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                      {showPw ? <VisibilityOffOutlinedIcon/> : <VisibilityOutlinedIcon/>}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </div>

          {/* Create */}
          <Button
            type="submit" variant="contained" disableElevation
            className={styles.fullButton}
            disabled={!canSubmit || loading}
          >
            {loading ? 'Creating…' : 'CREATE'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
