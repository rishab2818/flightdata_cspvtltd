// src/pages/admin/AdminDashboard.jsx
import React, { useContext, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import Sidebar from '../../components/admin/Sidebar';
import UserOverview from '../../components/admin/UserOverview';
import CreateUserCard from '../../components/admin/CreateUserCard';
import { AuthContext } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const fullName = useMemo(() => {
    // If you store first_name/last_name in auth later, use those;
    // for now we derive from email local part as a fallback.
    return user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.name || user?.email || 'Admin');
  }, [user]);

  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: '#F3F7FF' }}>
      <Sidebar />

      <Box component="main" sx={{
        flex: 1,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        p: 3
      }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500, color:'#0C3391', mb: 0.5 }}>
            Welcome!
          </Typography>
          <Typography sx={{ color:'#334155' }}>
            {fullName}
          </Typography>
        </Box>

        {/* Two-column layout */}
        <Box sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'minmax(420px, 510px) minmax(440px, 543px)',
          alignContent: 'start',
          // Push cards to left, extra space on right to visually match your reference
          justifyContent: 'start'
        }}>
          <Box key={refreshKey}><UserOverview /></Box>
          <CreateUserCard onCreated={() => setRefreshKey(k=>k+1)} />
        </Box>
      </Box>
    </Box>
  );
}
