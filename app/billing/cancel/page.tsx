import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold">Checkout canceled</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        No charge was made. You can try again anytime.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
