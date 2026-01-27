import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchTrendDashboard } from "../api/dashboard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function DashboardTrend() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    fetchTrendDashboard(projectId).then(setData);
  }, [projectId]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>협업 추세</h2>

      <h3>주간 커밋 활동</h3>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data.weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="commits"
              stroke="#8884d8"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
