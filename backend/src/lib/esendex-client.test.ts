/**
 * Esendex client (mocked fetch) — run: npx tsx backend/src/lib/esendex-client.test.ts
 */
import assert from "node:assert/strict";
import {
  EsendexClient,
  mapEsendexHttpError,
  resolveEsendexCredentials,
  type EsendexFetch,
} from "./esendex-client";

assert.equal(
  resolveEsendexCredentials({ env: {} as NodeJS.ProcessEnv }),
  null
);

const creds = resolveEsendexCredentials({
  user: "user@example.com",
  password: "secret",
  accountRef: "EX0000000",
  originator: "RebornPOS",
  env: {} as NodeJS.ProcessEnv,
});
assert.ok(creds);
assert.equal(creds?.accountRef, "EX0000000");

assert.equal(mapEsendexHttpError(402, "").code, "payment_required");
assert.equal(mapEsendexHttpError(401, "").code, "unauthorized");
assert.equal(mapEsendexHttpError(400, "No messages were supplied").code, "request_invalid");

const fetchMock: EsendexFetch = async (url, init) => {
  assert.match(url, /\/messagedispatcher$/);
  assert.equal(init.method, "POST");
  const body = JSON.parse(String(init.body || "{}"));
  assert.equal(body.accountreference, "EX0000000");
  assert.equal(body.messages[0].to, "41791234567");
  assert.equal(body.messages[0].from, "RebornPOS");
  return {
    status: 200,
    ok: true,
    async text() {
      return JSON.stringify({
        batch: {
          batchid: "batch-1",
          messageheaders: [{ id: "hdr-1", uri: "https://api.esendex.com/v1.0/messageheaders/hdr-1" }],
        },
      });
    },
  };
};

async function main() {
  const client = new EsendexClient(creds!, fetchMock);
  const sent = await client.sendSms({ to: "+41791234567", body: "Hello" });
  assert.equal(sent.ok, true);
  if (sent.ok) {
    assert.equal(sent.providerId, "hdr-1");
    assert.equal(sent.batchId, "batch-1");
  }

  const failFetch: EsendexFetch = async () => ({
    status: 402,
    ok: false,
    async text() {
      return "Not enough message credits";
    },
  });
  const failed = await new EsendexClient(creds!, failFetch).sendSms({
    to: "41791234567",
    body: "Hello",
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.code, "payment_required");
  }

  const empty = await client.sendSms({ to: "41791234567", body: "   " });
  assert.equal(empty.ok, false);

  console.log("esendex-client.test.ts: ok");
}

void main();
