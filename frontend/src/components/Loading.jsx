export default function Loading({ message = "로딩 중입니다..." }) {
  return (
    <div
      style={{
        padding: "40px",
        textAlign: "center",
        fontSize: "16px",
      }}
    >
      ⏳ {message}
    </div>
  );
}
