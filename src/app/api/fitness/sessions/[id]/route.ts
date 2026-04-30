import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/utils/api";
import { z } from "zod";

const patchSchema = z.object({
  status:       z.enum(["upcoming", "completed", "skipped"]),
  actual_notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body  = await req.json().catch(() => { throw new Error("Invalid JSON"); });
    const input = patchSchema.parse(body);

    const supabase = createClient();

    // RLS on fitness_sessions enforces ownership via the parent plan.
    // If the session doesn't belong to the authenticated user the update
    // returns no rows (PGRST116) rather than throwing.
    const { data, error } = await supabase
      .from("fitness_sessions")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
