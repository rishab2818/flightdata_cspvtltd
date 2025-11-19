// src/pages/admin/UserManagement.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/VpnKey";
import Sidebar from "../../components/admin/Sidebar";
import { usersApi } from "../../api/usersApi";
import ChangePasswordDialog from "../../components/admin/ChangePasswordDialog";
import AdminHeader from "../../components/admin/AdminHeader";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [pwdDlg, setPwdDlg] = useState({ open: false, email: null });
  const [confirm, setConfirm] = useState({ open: false, email: null });
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await usersApi.list();
      setUsers(data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load users");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.first_name || "").toLowerCase().includes(q) ||
        (u.last_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const changePassword = async (email, newPassword) => {
    await usersApi.update(email, { password: newPassword });
    await load();
  };

  const removeUser = async (email) => {
    await usersApi.remove(email);
    await load();
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "#F3F7FF" }}>
      <Sidebar />

      <Box component="main" sx={{ flex: 1, p: 3, display: "grid", alignContent: "start" }}>
        {/* Top bar with page title + avatar + logout */}
        <AdminHeader title="Manage User login" />

        <Card
          sx={{
            width: "clamp(920px, 70vw, 1080px)",
            height: "clamp(640px, 70vh, 788px)",
            borderRadius: "16px",
            boxShadow: "0 12px 28px rgba(16,24,40,0.08)",
            overflow: "hidden",
          }}
        >
          <CardContent
            sx={{ p: 2, height: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}
          >
            {/* Search row */}
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1 }}>
              <TextField
                placeholder="Enter name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                sx={{ width: 320 }}
              />
              <Box sx={{ flex: 1 }} />
              <Button variant="outlined" size="small" onClick={load} disabled={busy}>
                Refresh
              </Button>
            </Box>

            {/* Table area */}
            <Box sx={{ overflow: "auto", border: "1px solid #E2E8F0", borderRadius: 2 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Access</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Last Login</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((u) => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
                    const created = u.created_at?.replace("T", " ").slice(0, 19);
                    const last = u.last_login_at
                      ? u.last_login_at.replace("T", " ").slice(0, 19)
                      : "—";
                    return (
                      <TableRow key={u.email} hover>
                        <TableCell>{name || "—"}</TableCell>
                        <TableCell>
                          <Chip size="small" label={u.role} />
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{u.access_level_value}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={u.is_active ? "Yes" : "No"}
                            color={u.is_active ? "success" : "default"}
                          />
                        </TableCell>
                        <TableCell>{created}</TableCell>
                        <TableCell>{last}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Change password">
                            <IconButton
                              onClick={() => setPwdDlg({ open: true, email: u.email })}
                              size="small"
                            >
                              <KeyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete user">
                            <IconButton
                              onClick={() =>
                                setConfirm({ open: true, email: u.email })
                              }
                              size="small"
                              sx={{ ml: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!busy && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No users
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Change password dialog */}
      <ChangePasswordDialog
        open={pwdDlg.open}
        email={pwdDlg.email}
        onClose={() => setPwdDlg({ open: false, email: null })}
        onSubmit={(newPwd) => changePassword(pwdDlg.email, newPwd)}
      />

      {/* Confirm delete */}
      <Dialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, email: null })}
      >
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          Are you sure you want to delete <b>{confirm.email}</b>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false, email: null })}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await removeUser(confirm.email);
              setConfirm({ open: false, email: null });
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
