import React, { useEffect, useMemo, useState } from 'react';
import { usersApi } from '../../api/usersApi';
import { Card, CardContent } from '@mui/material';
import SpeedometerIcon from '../../assets/Speedometer.svg';
import RocketIcon from '../../assets/RocketLaunch.svg';
import Usersthreeicon from '../../assets/UsersThree.svg';
import medalicon from '../../assets/MedalMilitary.svg';
import bookicon from '../../assets/Book.svg';
import styles from './UserOverview.module.css';

/**
 * We match the five rows shown in your reference:
 * - Group Directors (GD)
 * - Team Leads (TL)
 * - System Managers (SM)
 * - Junior research Fellow (JRF)
 * - Contract Engineers (CE)
 *
 * Top 'Total Users' is all users length.
 */
const Rocket = () => <img src={RocketIcon} alt="RocketIcon" style={{ width: 22.5, height: 16.53 }} />;
const User3 = () => <img src={Usersthreeicon} alt="Usersthreeicon" style={{ width: 22.5, height: 16.53 }}/>;
const Medal = () => <img src={medalicon} alt="medalicon" style={{ width: 22.5, height: 16.53 }} />;
const Book = () => <img src={bookicon} alt="bookicon" style={{ width: 22.5, height: 16.53 }}/>;
const ROWS = [
  { role: 'GD', label: 'Group Directors', icon: <Medal /> },
  { role: 'TL', label: 'Team Leads', icon: <Rocket /> },
  { role: 'SM', label: 'System Managers', icon: <Rocket /> },
  { role: 'JRF', label: 'Junior research Fellow', icon: <Book /> },
  { role: 'CE', label: 'Contract Engineers', icon: <Book /> },
];



function pad2(n) {
  const v = Number(n ?? 0);
  return v < 10 ? `0${v}` : String(v);
}

export default function UserOverview() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await usersApi.list(); // expects Authorization header handled in usersApi
        if (alive) setUsers(Array.isArray(data) ? data : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => {
    const byRole = Object.fromEntries(ROWS.map(r => [r.role, 0]));
    for (const u of users) {
      const r = u?.role;
      if (r && byRole[r] !== undefined) byRole[r] += 1;
    }
    return { total: users.length, byRole };
  }, [users]);

  return (
    <Card className={styles.card}>
      <CardContent className={styles.body}>
        {/* Header */}
<div className={styles.header}>
  <img src={SpeedometerIcon} alt="Speedometer Icon" style={{ color: '#0F172A', width: '24px', height: '24px' }} />
  <div className={styles.headerTitle}>User Overview</div>
</div>

        {/* Total */}
        <div className={styles.totalWrap}>
          <div className={styles.totalRow}>
            <div className={styles.totalNum}>{pad2(totals.total)}</div>
            <div className={styles.totalLabel}>Total Users</div>
        {/* Icon */}
        <img 
        src={Usersthreeicon} 
        alt="users icon"
        className={styles.totalIcon}
        />
          </div>
      </div>
        <hr className={styles.hr} />

        {/* Rows */}
        <div className={styles.scroll} aria-busy={loading}>
          {ROWS.map((row, idx) => (
            <React.Fragment key={row.role}>
              <div className={styles.item}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemCount}>{pad2(totals.byRole[row.role])}</div>
                  <div className={styles.itemLabel}>
                    {row.label}{' '}
                    <span style={{ marginLeft: 8, verticalAlign: 'middle', color: '#0F172A' }}>
                      {row.icon}
                    </span>
                  </div>
                </div>
              </div>
              {/* divider between items, omit after last */}
              {idx < ROWS.length - 1 && <hr className={styles.hr} />}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
