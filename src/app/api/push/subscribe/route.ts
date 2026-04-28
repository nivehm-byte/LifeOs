import { NextResponse }                         from "next/server";
import { saveSubscription, removeSubscription } from "@/lib/push/actions";

// POST — save a new push subscription
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      endpoint: string;
      keys:     { p256dh: string; auth: string };
    };

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
    }

    await saveSubscription({
      endpoint:  body.endpoint,
      p256dh:    body.keys.p256dh,
      auth:      body.keys.auth,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — remove a subscription by endpoint
export async function DELETE(req: Request) {
  try {
    const { endpoint } = await req.json() as { endpoint: string };
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
