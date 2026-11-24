import { describe, expect, test } from "bun:test";
import { tursoConfig } from "./config";

describe("Turso connection configuration", () => {
  test("accepts a remote libsql URL", () => {
    expect(tursoConfig({ TURSO_DATABASE_URL: "libsql://test.turso.io", TURSO_AUTH_TOKEN: "test-token" }).url).toBe("libsql://test.turso.io");
  });
  test("accepts HTTPS", () => {
    expect(tursoConfig({ TURSO_DATABASE_URL: "https://test.turso.io", TURSO_AUTH_TOKEN: "test-token" }).url).toBe("https://test.turso.io");
  });
  test("rejects local file URLs", () => {
    expect(() => tursoConfig({ TURSO_DATABASE_URL: "file:./auditcore.sqlite", TURSO_AUTH_TOKEN: "test-token" })).toThrow();
  });
  test("requires both credentials without a local fallback", () => {
    expect(() => tursoConfig({})).toThrow();
    expect(() => tursoConfig({ TURSO_DATABASE_URL: "libsql://test.turso.io" })).toThrow();
  });
});