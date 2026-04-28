import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    const message = e.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ");
    return err(message, 422);
  }
  if (e instanceof Error) {
    if (e.message === "Not authenticated") return err("Unauthorized", 401);
    if (e.message === "Task not found")    return err("Task not found", 404);
    return err(e.message, 500);
  }
  return err("Unknown error", 500);
}
