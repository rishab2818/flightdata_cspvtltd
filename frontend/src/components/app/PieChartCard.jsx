import React, { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import Group from "../../assets/Group.svg";

const BORDER = "#0000001A";
const SHADOW = "0 10px 24px rgba(15, 23, 42, 0.06)";

function formatCompact(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  if (Math.abs(number) >= 1000000) {
    return `${(number / 1000000)
      .toFixed(number >= 10000000 ? 0 : 1)
      .replace(/\.0$/, "")}m`;
  }
  if (Math.abs(number) >= 1000) {
    return `${(number / 1000)
      .toFixed(number >= 10000 ? 0 : 1)
      .replace(/\.0$/, "")}k`;
  }
  return `${number}`;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 6,
        padding: "8px 10px",
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.12)",
        fontSize: 12,
        color: "#334155",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "#0F172A",
          marginBottom: 4,
        }}
      >
        {item.name}
      </div>
      <div>Value: {item.value}</div>
      <div>Percentage: {item.percentage}%</div>
    </div>
  );
}

function renderActiveShape(props) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export default function PieChartCard({ title, value, data = [] }) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const chartData = useMemo(() => {
    const cleaned = (Array.isArray(data) ? data : [])
      .map((item) => ({
        name: item?.name || "Unknown",
        shortName:
          item?.shortName ||
          (item?.name === "Wind" ? "WTD" : item?.name || "Unknown"),
        value: Number(item?.value || 0),
        color: item?.color || "#94A3B8",
      }))
      .filter((item) => item.value > 0);

    const total = cleaned.reduce((sum, item) => sum + item.value, 0);

    return cleaned.map((item) => ({
      ...item,
      percentage:
        total > 0 ? ((item.value / total) * 100).toFixed(1).replace(/\.0$/, "") : "0",
    }));
  }, [data]);

  const total = useMemo(
    () => chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  );

  const showChart = chartData.length > 0 && total > 0;

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        height: 333,
        padding: "28px 22px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 620,
        boxShadow: SHADOW,
      }}
    >
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          margin: 0,
          color: "#111827",
          fontFamily: `"SF Pro-Bold", Helvetica, sans-serif`,
        }}
      >
        {title}
      </h3>

      {showChart ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 280,
              height: 255,
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 6,
            }}
          >
            <div
              style={{
                width: 210,
                height: 185,
                position: "relative",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={78}
                    paddingAngle={0}
                    stroke="none"
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(-1)}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        fillOpacity={activeIndex === -1 || activeIndex === index ? 1 : 0.75}
                        style={{ cursor: "pointer" }}
                      />
                    ))}
                  </Pie>

                  {/* <Tooltip
                    content={<CustomTooltip />}
                    cursor={false}
                  /> */}
                  <Tooltip
  content={<CustomTooltip />}
  cursor={false}
  offset={22}
  wrapperStyle={{
    outline: "none",
    zIndex: 1000,
  }}
/>
                </PieChart>
              </ResponsiveContainer>

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 400,
                    color: "#222222",
                    lineHeight: 1,
                  }}
                >
                  {total}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              {chartData.map((item, index) => (
                <div
                  key={item.shortName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    color: "#6B7280",
                    fontWeight: 400,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                  title={`${item.shortName} - ${item.percentage}%`}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: item.color,
                      display: "inline-block",
                    }}
                  />
                  <span>
                    {item.shortName}
                    {activeIndex === index ? ` (${item.percentage}%)` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            gap: 10,
          }}
        >
          <img
            src={Group}
            alt="Empty"
            style={{ width: 180, height: "auto" }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#000",
              fontFamily: `"SF Pro-Bold", Helvetica, sans-serif`,
            }}
          >
            No data available yet.
          </div>
          <p
            style={{
              fontSize: 12,
              color: "#555",
              margin: 0,
              fontFamily: `"SF Pro-Regular", Helvetica, sans-serif`,
            }}
          >
            Once you upload a project, your visual insights will appear here
          </p>
        </div>
      )}

      {!showChart && value ? (
        <div
          style={{
            marginTop: "auto",
            fontSize: 13,
            color: "#64748B",
            textAlign: "center",
          }}
        >
          Current value:{" "}
          <strong style={{ color: "#0F172A" }}>{formatCompact(value)}</strong>
        </div>
      ) : null}
    </div>
  );
}
