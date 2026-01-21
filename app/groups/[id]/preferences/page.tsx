export default function PreferencesPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1>Preferences</h1>
      <p>Group ID: {params.id}</p>
      {/* TODO: Implement preferences view/edit */}
    </div>
  );
}
