import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createUser = vi.fn();
const resolveDeviceIntelligence = vi.fn();

vi.mock("@/lib/auth-store", () => ({
  createUser: (...args: unknown[]) => createUser(...args),
}));

vi.mock("@/lib/shield/server", () => ({
  resolveDeviceIntelligence: (...args: unknown[]) =>
    resolveDeviceIntelligence(...args),
}));

async function loadRoute() {
  return import("@/app/api/auth/signup/route");
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ALLOW = { device_intelligence: { is_bot: false } };
const BLOCK = { device_intelligence: { is_bot: true } };

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.resetModules();
    createUser.mockReset();
    resolveDeviceIntelligence.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when a required field is missing", async () => {
    const { POST } = await loadRoute();
    const res = await POST(jsonRequest({ email: "a@b.com" }));

    expect(res.status).toBe(400);
    expect(resolveDeviceIntelligence).not.toHaveBeenCalled();
  });

  it("returns 200 and creates a user when the device is allowed", async () => {
    resolveDeviceIntelligence.mockResolvedValue({
      result: ALLOW,
      source: "pull",
    });
    createUser.mockResolvedValue({ email: "a@b.com", password: "p" });
    const { POST } = await loadRoute();
    const res = await POST(
      jsonRequest({ email: "a@b.com", password: "p", sessionId: "s" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.decision).toBe("allow");
    expect(createUser).toHaveBeenCalledWith("a@b.com", "p");
  });

  it("returns 403 and does not create a user when the device is blocked", async () => {
    resolveDeviceIntelligence.mockResolvedValue({
      result: BLOCK,
      source: "pull",
    });
    const { POST } = await loadRoute();
    const res = await POST(
      jsonRequest({ email: "a@b.com", password: "p", sessionId: "s" }),
    );

    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 409 when the user already exists", async () => {
    resolveDeviceIntelligence.mockResolvedValue({
      result: ALLOW,
      source: "pull",
    });
    createUser.mockRejectedValue(new Error("User already exists"));
    const { POST } = await loadRoute();
    const res = await POST(
      jsonRequest({ email: "a@b.com", password: "p", sessionId: "s" }),
    );

    expect(res.status).toBe(409);
  });

  it("returns 500 when SHIELD resolution fails", async () => {
    resolveDeviceIntelligence.mockRejectedValue(new Error("SHIELD down"));
    const { POST } = await loadRoute();
    const res = await POST(
      jsonRequest({ email: "a@b.com", password: "p", sessionId: "s" }),
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("SHIELD down");
  });
});
