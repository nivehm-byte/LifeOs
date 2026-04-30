import { getDocuments, getDomains } from "@/lib/documents/queries";
import { DocumentBrowser }          from "@/components/documents/DocumentBrowser";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const [docs, domains] = await Promise.all([
    getDocuments().catch(() => []),
    getDomains().catch(() => []),
  ]);

  return <DocumentBrowser initialDocs={docs} domains={domains} />;
}
