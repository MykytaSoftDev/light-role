export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>
      {children}
    </div>
  );
}
