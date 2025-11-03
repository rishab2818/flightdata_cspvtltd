// src/components/admin/Sidebar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';

// Original SVGs only
import brandIcon from '../../assets/Database.svg';
import dashIcon from '../../assets/Database1.svg';
import usersIcon from '../../assets/UsersThree.svg';
import gearIcon from '../../assets/GearFine.svg';

// Remove `as const` — not valid in JS
const ICON_SIZE = { width: 24, height: 24, objectFit: 'contain' };

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = (p) => () => navigate(p);
  const isActive = (match) => pathname.startsWith(match);

  const menu = [
    { label: 'Dashboard',       path: '/admin',        icon: dashIcon },
    { label: 'User Management', path: '/admin/users',  icon: usersIcon },
    { label: 'Setting',         path: '/admin/setting', icon: gearIcon },
  ];

  return (
    <Box
      component="aside"
      sx={{
        width: 300,
        minWidth: 300,
        height: '100dvh',
        bgcolor: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
      }}
    >
      {/* Brand */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <img
          src={brandIcon}
          alt="Brand"
          style={{ width: 40, height: 40, borderRadius: 16, objectFit: 'cover' }}
        />
        <Typography sx={{ fontWeight: 700, color: '#0F172A' }}>
          Data Visualisation
        </Typography>
      </Box>

      {/* Navigation */}
      <List sx={{ mt: 1 }}>
        {menu.map(({ label, path, icon }) => {
          const active = isActive(path);

          return (
            <ListItemButton
              key={path}
              onClick={go(path)}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                bgcolor: active ? '#1976D2' : 'transparent',
                color: active ? '#FFFFFF' : 'inherit',
                '&:hover': {
                  bgcolor: active ? '#1565C0' : '#F5F5F5',
                },
                py: 1,
                px: 2,
                transition: 'all 0.2s ease',
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                <img
                  src={icon}
                  alt={label}
                  style={{
                    ...ICON_SIZE,
                    filter: active ? 'brightness(0) invert(1)' : 'none',
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontWeight: active ? 600 : 400,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}