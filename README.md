# Zambia Academic Credential Registry

*(Blockchain-Based Academic Certificate Verification System)*

## Project Description

A hybrid web + blockchain platform that prevents academic certificate forgery and streamlines certificate verification. Educational institutions issue digitally verifiable certificates whose SHA-256 hashes are anchored on an Ethereum blockchain, while the certificate data itself is stored in a relational database.

The system supports:

- Secure, role-based certificate issuance (university degrees, Grade 12 results, technical diplomas)
- Public certificate verification by Certificate ID
- Certificate revocation with a mandatory audit reason
- Verification and revocation audit logging
- Blockchain hash storage and on-chain verification, with retry on failed transactions

## Objectives

1. Analyze existing certificate verification methods
2. Design a decentralized certificate verification architecture
3. Develop a smart contract for certificate hash storage
4. Implement a web-based certificate management system
5. Evaluate system performance, security, and scalability

## System Architecture

Hybrid architecture combining a conventional web stack with a blockchain layer.

```
User → React Frontend → Express Backend API → MySQL Database
                                            ↓
                                     Ethereum Blockchain (hash only)
```

| Layer         | Technology                                    |
|---------------|------------------------------------------------|
| Presentation  | React (Vite) + Tailwind CSS — public verification portal & admin dashboard |
| Application   | Node.js + Express 5                           |
| Data          | MySQL 8 (via `mysql2`)                        |
| Blockchain    | Ethereum (Ganache locally / Sepolia testnet) via `ethers.js` v6 |
| Smart Contract| Solidity `^0.8.20`                            |

### Hybrid storage model

| Data                      | Storage Location |
|---------------------------|-------------------|
| Institution & user records| MySQL             |
| Certificate metadata      | MySQL              |
| Certificate hash (SHA-256)| Blockchain + MySQL (redundant copy for fast lookup) |
| Verification logs         | MySQL              |
| Revocation logs           | MySQL              |
| Blockchain transaction hash| MySQL             |

## Actual Project Structure

```
Blockchain-Based-Certificate-Verification-System/
├── backend/
│   ├── app.js                  # Express app + route mounting (actual entry point)
│   ├── server.js                # placeholder — not currently used to start the app
│   ├── config/
│   │   ├── db.js                 # MySQL connection pool
│   │   └── blockchain.js         # Ethers provider/signer/contract setup
│   ├── controllers/               # auth, certificate, verify
│   ├── services/                  # certificateService, verifyService (business logic)
│   ├── repositories/              # certificateRepository, logRepository (data access)
│   ├── middleware/                 # auth (JWT), rbac
│   ├── routes/                     # authRoutes, certificateRoutes, verifyRoutes, institutionRoutes
│   └── utils/                      # crypto.js (deterministic hashing), hashBuilder.js
├── blockchain/
│   ├── contracts/CertificateRegistry.sol
│   ├── scripts/deploy.js
│   └── hardhat.config.js
├── database/                       # schema/migrations/seeds folders exist but are not yet populated
├── frontend/
│   └── src/
│       ├── pages/                  # Home, Verify, Certificate, Admin/Login
│       ├── components/             # Navbar, Admin/CertificateList, Admin/CertificateIssuanceForm
│       └── services/api.js
└── docs/
```

## System Features

### Implemented

- **Authentication**: JWT-based login (`bcrypt` password hashing), role claims (`super_admin`, `institution_admin`, `verifier`)
- **RBAC**: middleware restricting issuance/revocation/retry to admin roles; institution-scoped data access
- **Certificate issuance**: type-specific validation (university / grade12 / technical) via Zod discriminated unions, deterministic SHA-256 hash generation, on-chain hash registration with automatic status tracking (`pending_blockchain` → `active` / `blockchain_failed`)
- **Certificate verification**: recomputes the hash from stored data, compares against the MySQL record, then cross-checks the hash on-chain; returns `VALID` / `INVALID` / `REVOKED` / `NOT_FOUND`
- **Revocation**: mandatory audit reason (≥10 characters), immutable `revocation_logs` entry
- **Blockchain retry**: re-attempts on-chain registration for certificates stuck in `blockchain_failed`
- **Audit logging**: every verification attempt is logged with IP and user agent
- **Admin dashboard** (React): issue certificates, list/search/filter institution certificates
- **Public verification portal** (React): lookup by Certificate ID, per-type result rendering

### Designed but not yet implemented

These have scaffolding (empty files, dependencies installed, or README-level intent) but no working code yet:

- QR code generation/scanning (`qrcode` dependency present, `utils/qrGenerator.js` is empty)
- Centralized error-handling middleware and structured logging
- Rate limiting on public endpoints (login, verify)
- Dedicated admin management endpoints (institution/user CRUD beyond raw registration)
- Versioned database schema/migrations (the live schema currently exists only in the running MySQL instance — the `database/` folder is scaffolded but empty)
- Smart contract test suite and on-chain access control (the contract currently allows any address to register/revoke; institution-level restriction is a planned Phase 4 item)

## API Endpoints

### Authentication

| Method | Endpoint             | Auth | Description         |
|--------|-----------------------|------|----------------------|
| POST   | `/api/auth/register`  | None | Register a user     |
| POST   | `/api/auth/login`     | None | Login, returns JWT   |
| GET    | `/api/auth/me`        | JWT  | Return current user from token |

### Certificates

| Method | Endpoint                                | Auth                          | Description |
|--------|-------------------------------------------|--------------------------------|--------------|
| POST   | `/api/certificates`                       | JWT + admin role               | Issue a certificate |
| GET    | `/api/certificates/my-institution`        | JWT                             | List certificates for the caller's institution (search/status/pagination) |
| GET    | `/api/certificates/:id`                   | JWT                             | Fetch a single certificate |
| POST   | `/api/certificates/:id/retry-blockchain`  | JWT + admin role                | Retry failed on-chain registration |
| POST   | `/api/certificates/:id/revoke`            | JWT + admin role                | Revoke a certificate (reason required) |
| GET    | `/api/certificates/:id/presentation`      | None                            | Public UI-config for a certificate type |

### Verification & Institutions

| Method | Endpoint                | Auth | Description |
|--------|--------------------------|------|--------------|
| POST   | `/api/verify`             | None | Verify a certificate by `cert_id` |
| GET    | `/api/institutions/:id`   | None | Public institution lookup |

### Health

| Method | Endpoint      | Description  |
|--------|----------------|--------------|
| GET    | `/api/health`  | DB connectivity check |

## Certificate Verification Process

1. Institution issues a certificate through the admin dashboard.
2. The backend canonicalizes the certificate data and computes a SHA-256 hash.
3. Certificate metadata is stored in MySQL (`pending_blockchain`).
4. The hash is registered on the Ethereum smart contract; on success the record becomes `active`.
5. The verifier (public or admin) submits a Certificate ID.
6. The backend recomputes the hash from stored data, compares it to the MySQL record, then calls `verifyCertificate` on-chain.
7. Result — `VALID`, `INVALID`, `REVOKED`, or `NOT_FOUND` — is returned along with certificate details and an audit log entry is written.

## Installation

```bash
# Backend
cd backend
npm install
node app.js          # server.js is currently a placeholder; app.js is the real entry point

# Frontend
cd frontend
npm install
npm run dev

# Blockchain (local Ganache/Hardhat network)
cd blockchain
npm install
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

Environment variables are read from `backend/.env` (`PORT`, `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`). The MySQL schema must currently be created manually to match the columns referenced in `backend/repositories/certificateRepository.js` (a versioned `schema.sql` is planned but not yet committed).

## Database Tables (in use)

- `institutions`
- `users`
- `certificates`
- `verification_logs`
- `revocation_logs`

(`blockchain_transactions` and `api_keys` are referenced in the original design but not yet used by any implemented code path.)

## Technology Stack

| Layer          | Technology |
|-----------------|------------|
| Frontend        | React 18, Vite, Tailwind CSS, lucide-react |
| Backend         | Node.js, Express 5 |
| Database        | MySQL 8 (`mysql2`) |
| Blockchain      | Ethereum (Ganache / Sepolia), `ethers.js` v6 |
| Smart Contracts | Solidity, Hardhat |
| Authentication  | JWT (`jsonwebtoken`), `bcryptjs` |
| Validation      | Zod |
| Version Control | Git & GitHub |

## Security Notes

- Parameterized SQL queries are used throughout the repository layer.
- Passwords are hashed with bcrypt; JWTs carry role and institution claims for RBAC.
- Hash comparison uses `crypto.timingSafeEqual` to avoid timing attacks.
- **Known gaps to address before any production use**: the registration endpoint currently accepts a caller-supplied role with no restriction, secrets currently live in tracked `.env` files rather than being excluded via `.gitignore`, and there is no rate limiting on authentication or verification endpoints. These are tracked as open items for the remaining project phases.

## Development Roadmap

| Phase   | Description                           | Status |
|---------|-----------------------------------------|--------|
| Phase 1 | Proposal & Research                     | Complete |
| Phase 2 | Backend & Database                      | Complete |
| Phase 3 | Smart Contracts                         | Complete (prototype; access control hardening pending) |
| Phase 4 | Frontend Development                     | Complete |
| Phase 5 | Security Hardening & Testing              | In Progress |
| Phase 6 | Final Report                             | In Progress |

## Testing

- `backend/test-hash.js` — unit tests for deterministic hash generation/normalization
- `backend/tests/run-all_tests.ps1` — API smoke-test script
- Smart contract tests, full integration tests, and formal security testing (SQLi/XSS) are planned but not yet written.

## Developers

- Elisha Lungu
- Nkonsi David Shumba

**Supervisor**: Mr. Andrea Theu
**Department**: Computing and Informatics, University of Zambia
**Year**: 2026

## License

Developed for academic and research purposes at the University of Zambia.
