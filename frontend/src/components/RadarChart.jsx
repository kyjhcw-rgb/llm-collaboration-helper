export default function RadarChart({ data }) {
  if (!data) return null;

  return (
    <div style={{ margin: "16px 0" }}>
      <h3>팀 협업 지표</h3>
      <ul>
        <li>집중도: {data.focus}</li>
        <li>균형: {data.balance}</li>
        <li>정체: {data.stagnation}</li>
        <li>리듬: {data.rhythm}</li>
        <li>압박: {data.pressure}</li>
      </ul>
    </div>
  );
}
