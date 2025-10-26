# FlightDV Frontend (React + Vite + Tailwind)

Login → role-based dashboard with optional **User Management** for Admin/GD/DH.

## Roles & Access
- ADMIN → access_level_value = 1
- GD, DH → 2
- TL, SM, OIC → 3
- JRF, SRF, CE, STUDENT → 4

For now:
- username `admin` → ADMIN
- username `dh` → DH
- anything else → GD

## Run
```bash
npm install
npm run dev
```

## Structure
```text
src/
  components/    # Icon, Sidebar, TopBar, TextInput, Stat
  context/       # auth.js (user context with roles/access)
  pages/         # LoginPage, DashboardPage, UserManagementPage, SettingsPage
  App.jsx
  main.jsx
tailwind.config.js
postcss.config.js
```

Swap the in-memory login with your API later by replacing `login()` in `src/context/auth.js`.
