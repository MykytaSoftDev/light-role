export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-sidebar">
        <div className="p-4">
          <span className="font-semibold">Light Role</span>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
