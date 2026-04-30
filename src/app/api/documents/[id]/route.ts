import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

interface Params { params: Promise<{ id: string }> }

// ── GET /api/documents/[id] — return a short-lived signed URL ───
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Use service client to create signed URL for private bucket
  const service = createServiceClient();
  const { data: signed, error: urlErr } = await service.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 3600); // 1-hour expiry

  if (urlErr || !signed) {
    return NextResponse.json({ error: "Could not generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}

// ── DELETE /api/documents/[id] ───────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("storage_path, user_id")
    .eq("id", id)
    .single();

  if (fetchErr || !doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.storage.from("documents").remove([doc.storage_path]);
  await supabase.from("documents").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
