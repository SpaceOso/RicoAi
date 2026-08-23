import { sql } from "@/lib/db";

const MINUTE_LIMIT = 5;
const DAY_LIMIT = 30;

let schemaReady: Promise<unknown> | null = null;

function ensureSchema() {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS rate_limit_events (
      id BIGSERIAL PRIMARY KEY,
      ip TEXT NOT NULL,
      route TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.then(
    () => sql`
      CREATE INDEX IF NOT EXISTS rate_limit_events_ip_route_created_at_idx
      ON rate_limit_events (ip, route, created_at)
    `,
  );
  return schemaReady;
}

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

/**
 * Fixed-window limiter backed by Postgres so it holds across cold starts and
 * serverless instances, unlike an in-memory counter. Fails open if the DB is
 * unreachable — a logging outage shouldn't take down the whole route.
 */
export async function checkRateLimit(
  ip: string,
  route: string,
): Promise<RateLimitResult> {
  try {
    await ensureSchema();

    const [{ minute_count, day_count }] = (await sql`
      SELECT
        count(*) FILTER (WHERE created_at > now() - interval '1 minute') AS minute_count,
        count(*) FILTER (WHERE created_at > now() - interval '1 day') AS day_count
      FROM rate_limit_events
      WHERE ip = ${ip} AND route = ${route} AND created_at > now() - interval '1 day'
    `) as { minute_count: string; day_count: string }[];

    if (Number(minute_count) >= MINUTE_LIMIT) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    if (Number(day_count) >= DAY_LIMIT) {
      return { allowed: false, retryAfterSeconds: 86_400 };
    }

    await sql`INSERT INTO rate_limit_events (ip, route) VALUES (${ip}, ${route})`;

    // Opportunistic cleanup so the table doesn't grow unbounded — no cron needed.
    if (Math.random() < 0.01) {
      await sql`DELETE FROM rate_limit_events WHERE created_at < now() - interval '1 day'`;
    }

    return { allowed: true };
  } catch (error) {
    console.error("checkRateLimit failed:", error);
    return { allowed: true };
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
