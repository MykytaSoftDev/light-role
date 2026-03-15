import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold tracking-tight">Light Role</h1>
      <p className="mt-4 text-xl text-muted-foreground">
        AI-powered job search management platform
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <a href="/auth/register">Get Started</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/auth/login">Sign In</a>
        </Button>
      </div>
    </main>
  );
}
