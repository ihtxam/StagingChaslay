# Fiskaly SIGN DE (Germany / KassenSichV)

Reborn POS integrates [Fiskaly SIGN DE](https://workspace.fiskaly.com/api/sign-de/#section/Quick-Start) via the certified **KassenSichV middleware API** (`kassensichv-middleware.fiskaly.com/api/v2`).

## Merchant setup (panel)

1. Set merchant **country** to Germany (DE).
2. Open **Settings → Fiscal (Fiskaly)**.
3. Paste **API key** and **API secret** from [Fiskaly workspace](https://workspace.fiskaly.com/) (test or live).
4. Choose **Environment** = Test while integrating.
5. Click **Test connection** (validates auth; if TSS/client IDs are saved, validates them too).
6. Click **Create cloud TSS & client** — creates an initialized cloud TSS, registers a POS client, and stores **TSS ID**, **Client ID**, and **client serial** on the merchant.
7. Enable **Fiskaly signing** and **Save**.

## Runtime behaviour

- When signing is enabled, each **completed paid POS sale** pushed through `/sync/push-sales` is signed with Fiskaly.
- The order stores `fiskalySignature` (QR payload, signature, transaction id).
- WebPOS prints the **Fiskaly QR** on the guest receipt when present (instead of the digital receipt URL).

## Credentials

- Never commit API secrets to git.
- Store credentials only in merchant settings (encrypted at rest per your deployment).
- Rotate keys in Fiskaly workspace if a secret was exposed.

## Test vs live

- Test keys sign in Fiskaly **TEST** environment (`_env: TEST` on TSS).
- Switch environment to **Live** only after live API credentials and production TSS are ready.

## References

- [SIGN DE Quick Start](https://workspace.fiskaly.com/api/sign-de/#section/Quick-Start)
- [Fiskaly developer docs](https://developer.fiskaly.com/sign-de/introduction)
