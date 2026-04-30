"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateDocs() {
  revalidateTag("documents");
  revalidatePath("/documents");
}

export async function deleteDocumentAction(docId: string) {
  const supabase = createClient();

  // Fetch the storage_path before deleting the DB row
  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", docId)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);

  // Remove from Storage first
  const { error: storageErr } = await supabase.storage
    .from("documents")
    .remove([doc.storage_path]);

  if (storageErr) {
    console.warn("[documents/delete] storage remove failed:", storageErr.message);
  }

  const { error: dbErr } = await supabase.from("documents").delete().eq("id", docId);
  if (dbErr) throw new Error(dbErr.message);

  revalidateDocs();
}
