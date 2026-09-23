import { redirect } from "next/navigation";

export default async function EventHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/console/events/${id}/delegations`);
}
