// src/pages/admin/UserManagement.jsx
import React, { useEffect, useState, useMemo } from "react";
import { FiSearch} from "react-icons/fi";
import {
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
// import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/VpnKey";
import { usersApi } from "../../api/usersApi";
import "./UserManagement.css";
import ChangePasswordDialog from "../../components/admin/ChangePasswordDialog";
import Delete from '../../assets/Delete.svg'
import password from '../../assets/password.svg'
import TablePagination from "@mui/material/TablePagination";


export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [pwdDlg, setPwdDlg] = useState({ open: false, email: null });
  const [confirm, setConfirm] = useState({ open: false, email: null });
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
 

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

  const filtered = useMemo(() => {
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
    setConfirm({ open: false, email: null });
  };

  const paginatedUsers = useMemo(() => {
  const start = page * rowsPerPage;
  const end = start + rowsPerPage;
  return filtered.slice(start, end);
}, [filtered, page, rowsPerPage]);


  return (
    <div className="user-management-page">
      <div className="user-management-card">

        <div className="user-management-title">
          Manage User Login
        </div>

        <div className="user-management-content">
          <div className="user-management-toolbar">
            <div className="searchBox">
         
                                    <FiSearch size={16} color="#64748b" />
                                    <input
                                      className="user-management-search"
                                      placeholder="Search by name, email or role"
                                      value={search}
                                      onChange={(e) => setSearch(e.target.value)}
                                    />
                    </div>

            <div className="user-management-spacer" />

            <Button
              variant="outlined"
              size="small"
              onClick={load}
              disabled={busy}
              className="RefreshButton"
            >
              Refresh
            </Button>
          </div>

          {/* Table */}
          <div className="user-management-table-wrapper">
            {error && <Alert severity="error">{error}</Alert>}

            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow className="user-management-table-head">
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
                {/* {filtered.map((u) => ( */}
                {paginatedUsers.map((u) => (
                  <TableRow key={u.email} className="user-management-table-row">
                    <TableCell>{u.first_name} {u.last_name}</TableCell>
                    <TableCell>
                      <Chip size="small" label={u.role} />
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.access_level_value}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={u.is_active ? "Yes" : "No"}
                        className={u.is_active ? "chip-active" : "chip-inactive"}
                      />
                    </TableCell>
                    <TableCell>{u.created_at}</TableCell>
                    <TableCell>{u.last_login_at || "—"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Change password">
                        <IconButton
                          size="small"
                          className="action-btn password"
                          onClick={() =>
                            setPwdDlg({ open: true, email: u.email })
                          }
                        >
                          <img style={{width:'20px', height:'20px'}} src={password} alt="password"/>
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Delete user">
                        <IconButton
                          size="small"
                          className="action-btn delete"
                          onClick={() =>
                            setConfirm({ open: true, email: u.email })
                          }
                        > 
                          <img style={{width:'20px', height:'20px'}} src={Delete} alt="delete"/>
                          {/* <DeleteIcon fontSize="small" /> */}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
  component="div"
  count={filtered.length}
  page={page}
  onPageChange={(e, newPage) => setPage(newPage)}
  rowsPerPage={rowsPerPage}
  onRowsPerPageChange={(e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }}
  rowsPerPageOptions={[5, 10, 25]}
 />

          </div>
        </div>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={pwdDlg.open}
        email={pwdDlg.email}
        onClose={() => setPwdDlg({ open: false, email: null })}
        onSubmit={(pwd) => changePassword(pwdDlg.email, pwd)}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, email: null })}
      >
        <DialogTitle>Delete user</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this user?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false, email: null })}>
            Cancel
          </Button>
          <Button color="error" onClick={() => removeUser(confirm.email)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
