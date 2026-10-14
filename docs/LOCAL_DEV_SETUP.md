# Local Dev Setup & Mobile QR Verification

## Backend environment

`backend/.env` is gitignored and not created automatically — copy
`backend/.env.example` to `backend/.env` and fill in:

- `DB_HOST` / `DB_USER` / `DB_PASS` / `DB_NAME` — local MySQL.
- `JWT_SECRET` — any long random string.
- `BLOCKCHAIN_RPC_URL` — `http://127.0.0.1:8545` for local Ganache.
- `CONTRACT_ADDRESS` — the deployed `CertificateRegistry` address. Deploy
  with `cd blockchain && npx hardhat run scripts/deploy.js --network
  localhost` (requires Ganache running first).
- `BLOCKCHAIN_PRIVATE_KEY` — a private key from a funded Ganache account
  (Ganache UI → Accounts tab → key icon). The contract has no owner
  restriction, so any funded account works.

## Verifying a certificate from a phone (QR code)

A certificate's printed QR code encodes a URL to `/verify?id=<cert_id>`.
"localhost" only ever resolves to the device loading the page, so a phone
scanning a QR built against `localhost` tries to reach itself, not your PC.
To make this work on a phone over the same Wi-Fi:

1. **Vite must listen on your LAN interface**, not just localhost. This is
   already set in `frontend/vite.config.js` (`server: { host: true }`).
2. **Set the frontend's env vars** in `frontend/.env.local` (gitignored) to
   your machine's LAN IP (find it with `ipconfig`, the IPv4 address under
   your Wi-Fi/Ethernet adapter):
   ```
   VITE_API_BASE_URL=http://<your-LAN-IP>:5000/api
   VITE_PUBLIC_BASE_URL=http://<your-LAN-IP>:5173
   ```
   `VITE_API_BASE_URL` is what the frontend calls for the backend API.
   `VITE_PUBLIC_BASE_URL` is what gets embedded in the QR code
   (`pages/Certificate.jsx`) — without it, the QR falls back to
   `window.location.origin`, which is only correct if you *always* open the
   dashboard via the LAN IP rather than `localhost`.
3. **Open the admin dashboard via the LAN IP** (`http://<your-LAN-IP>:5173`)
   when issuing or printing a certificate, not `localhost` — whichever
   origin is in the browser URL bar is what gets embedded in the QR unless
   `VITE_PUBLIC_BASE_URL` is set.
4. The backend already listens on `0.0.0.0` (`app.js`), so it accepts LAN
   connections once your firewall allows the port.
5. If it still doesn't connect, check Windows Firewall isn't blocking inbound
   connections on ports 5000 (backend) and 5173 (frontend dev server) — this
   needs to be allowed manually per machine, it isn't something the app
   config can do for you.

Your LAN IP can change if your router reassigns it (DHCP) — if phone
verification suddenly stops working after a reboot, re-check `ipconfig` and
update `frontend/.env.local`.

## Admin accounts

Each institution has one `institution_admin` account; there's also a
separate `super_admin` for system-wide maintenance (bypasses all
institution-type issuance rules — see `INSTITUTION_AUTHORIZATION.md`).

| Email | Role | Institution |
|---|---|---|
| admin@unza.zm | institution_admin | UNZA |
| admin@cbu.ac.zm | institution_admin | CBU |
| admin@ecz.zm | institution_admin | ECZ |
| admin@zaqa.zm | institution_admin | ZAQA |
| sysadmin@registry.zm | super_admin | — |

Passwords were set during initial setup and are not recorded here —
change them after first login via `POST /api/admin/users` or a direct
password reset if forgotten.

## Known fixed issues

- **Verification page showed blank student name / issue date** —
  `verifyService.js`'s per-type `DETAIL_STRATEGIES` never included those two
  fields in the response, even though the frontend always expected them.
- **`Data truncated for column 'status'`** on issuance — the live DB's
  `certificates.status` enum only had `active`/`revoked`/`suspended`, but the
  issuance flow needs `pending_blockchain`/`blockchain_failed` to keep a
  cert's DB row and its on-chain registration atomic, and a
  `blockchain_tx_hash` column to record the transaction. Fixed by
  `database/migrations/006_add_pending_blockchain_status.sql`.
