import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold">Payment successful</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Your balance will update shortly. You can close this page and return to the dashboard.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
