
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const BORDER = "#0000001A";

export default function PieChartCard({title,value}){
  const data=[
    {name:'Aero',value:400},
    {name:'WTD',value:300},
    {name:'Flight',value:200},
    {name:'CFD',value:700},
  ];
  const COLORS=['#7b61ff','#ff7b9c','#00bcd4','#82ca9d'];
  return (
    <div style={{position:'relative',width:420,height:416,gap:10,borderRadius:8,background:'#fff',border:`1px solid ${BORDER}`,padding:'35px 25px'}}>
      <h3 style={{fontSize:16,fontWeight:600,margin:0,color:'#0f172a'}}>{title}</h3>
      <p style={{fontSize:13,color:'#475569',marginTop:4,marginBottom:12}}>Distribution of different datasets</p>
      <div style={{width:'100%',height:250}}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={60} outerRadius={80} paddingAngle={5}>
              {data.map((_,i)=>(<Cell key={i} fill={COLORS[i%COLORS.length]}/>))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontWeight:'700',fontSize:24}}>{value}</div>
    </div>
  );
}
