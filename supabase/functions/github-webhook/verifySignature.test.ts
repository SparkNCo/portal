import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { verifyGithubSignature } from "./verifySignature.ts";

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

Deno.test("accepts a correctly signed payload", async () => {
  const secret = "test-secret";
  const body = JSON.stringify({ ref: "feat/SPA-123", ref_type: "branch" });
  const signature = await sign(secret, body);

  assertEquals(await verifyGithubSignature(body, signature, secret), true);
});

Deno.test("rejects a tampered payload", async () => {
  const secret = "test-secret";
  const body = JSON.stringify({ ref: "feat/SPA-123", ref_type: "branch" });
  const signature = await sign(secret, body);
  const tampered = JSON.stringify({ ref: "feat/SPA-999", ref_type: "branch" });

  assertEquals(await verifyGithubSignature(tampered, signature, secret), false);
});

Deno.test("rejects a signature produced with the wrong secret", async () => {
  const body = JSON.stringify({ ref: "feat/SPA-123", ref_type: "branch" });
  const signature = await sign("wrong-secret", body);

  assertEquals(await verifyGithubSignature(body, signature, "test-secret"), false);
});

Deno.test("rejects a missing signature header", async () => {
  const body = JSON.stringify({ ref: "feat/SPA-123", ref_type: "branch" });

  assertEquals(await verifyGithubSignature(body, null, "test-secret"), false);
});

Deno.test("rejects a header without the sha256= prefix", async () => {
  assertEquals(await verifyGithubSignature("{}", "deadbeef", "test-secret"), false);
});
