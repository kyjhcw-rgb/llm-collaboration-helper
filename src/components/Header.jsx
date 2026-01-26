import { useEffect, useState } from "react";
import { fetchProjectHeader } from "../api/project";

export default function Header({ projectId }) {
  const [project, setProject] = useState(null);

  useEffect(() => {
    if (!projectId) return;

    fetchProjectHeader(projectId).then(setProject);
  }, [projectId]);

  return (
    <header
      style={{
        padding: "16px",
        borderBottom: "1px solid #ddd",
        background: "#fafafa",
      }}
    >
      <h2>{project ? project.name : "Loading..."}</h2>
    </header>
  );
}
