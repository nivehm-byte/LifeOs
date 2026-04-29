import { notFound }         from "next/navigation";
import { getClientById }    from "@/lib/clients/queries";
import { ClientDetailView } from "@/components/clients/ClientDetailView";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id }  = await params;
  const client  = await getClientById(id).catch(() => null);

  if (!client) notFound();

  return <ClientDetailView client={client} />;
}
