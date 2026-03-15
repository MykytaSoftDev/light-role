export default async function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-3xl font-bold">Resume Editor</h1>
      <p className="mt-2 text-muted-foreground">Resume {id} editor — coming soon</p>
    </div>
  );
}
