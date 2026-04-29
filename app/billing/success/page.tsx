import BillingSuccessConfirm from "@/components/billing/BillingSuccessConfirm";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  return <BillingSuccessConfirm sessionId={sessionId} />;
}
