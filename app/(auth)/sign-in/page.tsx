import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your Google account to continue.
        </p>
      </div>
      <SignInFormWrapper searchParams={searchParams} />
    </main>
  );
}

async function SignInFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mt-8 space-y-4">
      {params.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {prettifyError(params.error)}
        </div>
      )}
      <SignInForm inviteToken={params.invite} />
    </div>
  );
}

function prettifyError(code: string): string {
  switch (code) {
    case "needs_invite":
      return "You need an invite to sign in. Ask an owner to invite you.";
    case "missing_code":
      return "OAuth flow was interrupted. Please try again.";
    default:
      return decodeURIComponent(code);
  }
}
