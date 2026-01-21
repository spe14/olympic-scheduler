export default function SessionsPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Browse Sessions</h1>
      <p>Group ID: {params.id}</p>
      {/* TODO: Implement session browsing and selection */}
    </div>
  );
}
