export default function GroupPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Group Overview</h1>
      <p>Group ID: {params.id}</p>
      {/* TODO: Implement group overview */}
    </div>
  );
}
