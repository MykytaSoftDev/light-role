export default async function CoverLetterEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-3xl font-bold">Cover Letter Editor</h1>
      <p className="mt-2 text-muted-foreground">CL {id} editor — coming soon</p>
    </div>
  );
}
