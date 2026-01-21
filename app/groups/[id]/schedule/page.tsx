export default function SchedulePage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Generated Schedule</h1>
      <p>Group ID: {params.id}</p>
      {/* TODO: Implement schedule display */}
    </div>
  );
}
