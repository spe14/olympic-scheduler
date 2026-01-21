export default function ConfigurePage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Schedule Configuration</h1>
      <p>Group ID: {params.id}</p>
      {/* TODO: Implement schedule configuration form */}
    </div>
  );
}
