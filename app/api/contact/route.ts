import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  CONTACT_FROM_EMAIL,
  CONTACT_TO_EMAIL,
  hasResendKey,
  resend,
} from "@/lib/resend";

export const runtime = "nodejs";

const RequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(request: Request) {
  if (!hasResendKey() || !CONTACT_TO_EMAIL) {
    return Response.json(
      { error: "Contact form is not configured." },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(ip, "contact");
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, email, message } = parsed.data;

  const { error } = await resend.emails.send({
    from: `Portfolio contact form <${CONTACT_FROM_EMAIL}>`,
    to: CONTACT_TO_EMAIL,
    replyTo: email,
    subject: `New message from ${name}`,
    text: `${message}\n\n—\n${name} <${email}>`,
  });

  if (error) {
    return Response.json({ error: "Failed to send message." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
