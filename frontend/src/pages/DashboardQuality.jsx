<<<<<<< HEAD
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// import { fetchQualityDashboard } from "../api/dashboard";

export default function DashboardQuality() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    // 🔹 임시 더미 데이터
    const dummyData = {
      summary: {
        buildSuccessRate: "92%",
        testCoverage: "78%",
        lintErrors: 12,
        lastUpdated: "2026-01-23",
      },
    };

    // 실제 API 대신 더미 데이터 사용
    setTimeout(() => {
      setData(dummyData);
    }, 500);

    // 실제 API 붙일 때 이 부분만 되살리면 됨
    // fetchQualityDashboard(projectId).then(setData);
  }, [projectId]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>빌드 & 퀄리티 대시보드</h2>

      <ul>
        <li>빌드 성공률: {data.summary.buildSuccessRate}</li>
        <li>테스트 커버리지: {data.summary.testCoverage}</li>
        <li>Lint 에러 수: {data.summary.lintErrors}</li>
        <li>마지막 업데이트: {data.summary.lastUpdated}</li>
      </ul>
    </div>
  );
}
=======
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// import { fetchQualityDashboard } from "../api/dashboard";

export default function DashboardQuality() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    // 🔹 임시 더미 데이터
    const dummyData = {
      summary: {
        buildSuccessRate: "92%",
        testCoverage: "78%",
        lintErrors: 12,
        lastUpdated: "2026-01-23",
      },
    };

    // 실제 API 대신 더미 데이터 사용
    setTimeout(() => {
      setData(dummyData);
    }, 500);

    // 실제 API 붙일 때 이 부분만 되살리면 됨
    // fetchQualityDashboard(projectId).then(setData);
  }, [projectId]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>빌드 & 퀄리티 대시보드</h2>

      <ul>
        <li>빌드 성공률: {data.summary.buildSuccessRate}</li>
        <li>테스트 커버리지: {data.summary.testCoverage}</li>
        <li>Lint 에러 수: {data.summary.lintErrors}</li>
        <li>마지막 업데이트: {data.summary.lastUpdated}</li>
      </ul>
    </div>
  );
}
>>>>>>> origin/develop
