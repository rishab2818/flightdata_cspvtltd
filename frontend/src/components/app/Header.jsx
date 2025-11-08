
import React, { useContext, useMemo, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
export default function Header(){
  const { user } = useContext(AuthContext);
  const fullName = useMemo(() => {
    // If you store first_name/last_name in auth later, use those;
    // for now we derive from email local part as a fallback.
    return user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.name || user?.email || 'Admin');
  }, [user]);

  return (
    <div style={{width:'100%',height:65,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'36px 36px 0 36px'}}>
      <div>
        <h1 style={{fontSize:28,fontWeight:600,color:'#0f172a',margin:0}}>Welcome!</h1>
        <p style={{marginTop:-4,color:'#334155'}}>{fullName}</p>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:48,height:48,borderRadius:'50%',background:'#cbd5e1'}}/>
        <div>
          <div style={{fontWeight:600,color:'#0f172a'}}>{fullName}</div>
          <div style={{fontSize:14,color:'#475569'}}>{user.role}</div>
        </div>
      </div>
    </div>
  );
}
