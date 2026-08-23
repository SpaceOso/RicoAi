import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const checkRateLimitMock = vi.fn();

vi.mock("@/lib/resend", () => ({
  hasResendKey: () => true,
  CONTACT_TO_EMAIL: "miguel@example.com",
  CONTACT_FROM_EMAIL: "portfolio@example.com",
  resend: { emails: { send: sendMock } },
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "1.2.3.4",
  checkRateLimit: checkRateLimitMock,
}));

const VALID_BODY = {
  name: "Jane Recruiter",
  email: "jane@example.com",
  message: "Would love to chat about a role.",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

let POST: typeof import("./route").POST;

beforeEach(async () => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  sendMock.mockResolvedValue({ data: {}, error: null });
  ({ POST } = await import("./route"));
});

describe("POST /api/contact", () => {
  it("sends an email and returns ok for a valid submission", async () => {
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      to: "miguel@example.com",
      replyTo: VALID_BODY.email,
    });
  });

  it("rejects an invalid body without sending an email", async () => {
    const res = await post({ name: "", email: "not-an-email", message: "" });
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 429 and skips sending when rate limited", async () => {
    checkRateLimitMock.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the email provider fails", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "down" } });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(502);
  });
});

describe("POST /api/contact when unconfigured", () => {
  it("returns 503 without checking rate limits or sending mail", async () => {
    vi.resetModules();
    vi.doMock("@/lib/resend", () => ({
      hasResendKey: () => false,
      CONTACT_TO_EMAIL: "",
      CONTACT_FROM_EMAIL: "portfolio@example.com",
      resend: { emails: { send: sendMock } },
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      getClientIp: () => "1.2.3.4",
      checkRateLimit: checkRateLimitMock,
    }));

    const { POST: unconfiguredPost } = await import("./route");
    const res = await unconfiguredPost(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(res.status).toBe(503);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
