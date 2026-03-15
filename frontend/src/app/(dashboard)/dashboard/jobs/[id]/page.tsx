export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-3xl font-bold">Job Detail</h1>
      <p className="mt-2 text-muted-foreground">Job {id} — coming soon</p>
    </div>
  );
}
