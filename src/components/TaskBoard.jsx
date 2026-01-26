export default function TaskBoard({ kanban }) {
  if (!kanban) return null;

  const renderColumn = (title, tasks) => (
    <div style={{ flex: 1, margin: "0 8px" }}>
      <h3>{title}</h3>
      {tasks.length === 0 && <p>항목 없음</p>}
      {tasks.map((task) => (
        <div
          key={task.taskId}
          style={{
            border: "1px solid #ccc",
            padding: "8px",
            marginBottom: "8px",
          }}
        >
          <strong>{task.title}</strong>
          <p>담당자: {task.worker}</p>
          <p>상태: {task.validationStatus}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", marginTop: "16px" }}>
      {renderColumn("TODO", kanban.todo)}
      {renderColumn("IN PROGRESS", kanban.inProgress)}
      {renderColumn("DONE", kanban.done)}
    </div>
  );
}
