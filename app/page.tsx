import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">SweetPotatoFry</h1>
        <p className="text-muted-foreground">
          Property management for Maltese long-lets.
        </p>
      </div>
      <Link
        href="/sign-in"
        className="mt-10 inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
      >
        Sign in
      </Link>
    </main>
  );
}
