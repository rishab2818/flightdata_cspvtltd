// src/components/admin/ChangePasswordDialog.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert
} from '@mui/material';

export default function ChangePasswordDialog({ open, email, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (busy) return;
    setPassword(''); setError('');
    onClose?.();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!password.trim()) { setError('Password is required'); return; }
    try {
      setBusy(true); setError('');
      await onSubmit?.(password.trim());
      handleClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Change password</DialogTitle>
      <form onSubmit={submit}>
        <DialogContent dividers>
          {email && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>{email}</div>}
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField
            label="New Password"
            fullWidth
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disableElevation disabled={busy} sx={{ bgcolor:'#1E63E9', '&:hover':{bgcolor:'#1b58ce'} }}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
