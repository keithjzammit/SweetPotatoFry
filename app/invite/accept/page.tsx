import Link from "next/link";

// Landing page when a recipient clicks an invite email link. The actual
// acceptance happens after sign-in (the token is forwarded to the OAuth
// callback as ?invite=…).
export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-xl font-semibold">Invalid invite link</h1>
      </main>
    );
  }
  const signInHref = `/sign-in?invite=${encodeURIComponent(token)}`;
  return (
    <main className="mx-auto max-w-md px-6 py-16 space-y-4">
      <h1 className="text-xl font-semibold">You&apos;ve been invited</h1>
      <p className="text-sm text-muted-foreground">
        Sign in with your Google account to accept. The email you sign in with
        must match the one this invite was sent to.
      </p>
      <Link
        href={signInHref}
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
      >
        Continue
      </Link>
    </main>
  );
}
