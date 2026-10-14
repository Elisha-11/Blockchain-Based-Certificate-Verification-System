# Institution Authorization & Certificate Types

How issuance rights are regulated across the four institutions on the
registry, and how certificate types map to real-world credentials.

## Institutions

| Code | Name | `institutions.type` | Role |
|---|---|---|---|
| UNZA | University of Zambia | `university` | Issues degrees & diplomas |
| CBU | Copperbelt University | `university` | Issues degrees & diplomas |
| ECZ | Examinations Council of Zambia | `examination_council` | Issues Grade 7/9/12 and GCE results |
| ZAQA | Zambia Qualifications Authority | `regulatory_body` | Regulator — issues nothing |

`college` is also a supported `institutions.type` with the same rights as
`university`, for any future institution that isn't a full university.

## Certificate types

| `certificate_type` | Issued by | Key fields |
|---|---|---|
| `university` | university / college | `program`, `class_of_degree`, `student_id` (10-digit, optional) |
| `technical` | university / college | `program`, `diploma_type`, `student_id` (10-digit, optional) |
| `examination` | examination_council | `level` (`grade7`\|`grade9`\|`grade12`\|`gce`), `candidate_number`, `subjects[]` |

`examination` unifies what used to be a single `grade12`-only type — Grade 7,
Grade 9, Grade 12, and GCE all share the same shape and differ only by
`level`. Certificates issued before this change still have
`certificate_type='grade12'` in the database; they are **not** migrated,
because `certificate_type` is part of the SHA-256 hash input
(`buildCertificateHashInput`/`buildVerificationHashInput`) — changing the
stored value without recomputing the hash would break that certificate's
verification. Instead, `grade12` is kept as a permanent backward-compatible
alias wherever certificate type drives behavior:
- `certificateService.getPresentationConfig()` — `configs.grade12 = configs.examination`
- `verifyService.DETAIL_STRATEGIES` — `DETAIL_STRATEGIES.grade12 = DETAIL_STRATEGIES.examination`
- frontend `utils/certificateTheme.js` — `resolveCertType()` maps `grade12` → `examination`

## Enforcement

Authorization is enforced server-side in `certificateController.issue`
(backend/controllers/certificateController.js), against a **fresh DB read**
of the authenticated user's institution — not the JWT — so a status change
takes effect immediately rather than waiting for the token to expire:

```js
const ALLOWED_CERT_TYPES_BY_INSTITUTION_TYPE = {
  university: ['university', 'technical'],
  college: ['university', 'technical'],
  examination_council: ['examination'],
  regulatory_body: []
};
```

Two checks run before an issuance request reaches `certificateService`:

1. **Qualified?** `institutions.is_active` must be true. ZAQA can suspend an
   institution (see below), which blocks issuance immediately.
2. **Authorized for this type?** The requested `certificate_type` must be in
   that institution's allowed list.

`super_admin` accounts bypass both checks — intended for system
administration, not for day-to-day issuance on behalf of an institution.
Each institution's own admin account is `institution_admin`, bound by the
rules above like everyone else.

The frontend (`CertificateIssuanceForm.jsx`) mirrors the same allow-list to
hide credential types the logged-in institution can't issue, but this is a
UX convenience only — the backend check is the actual security boundary.

## ZAQA: qualifying institutions

ZAQA (`institutions.type = 'regulatory_body'`) cannot issue certificates. Its
admin dashboard instead shows a "Manage Institutions" tab
(`components/Admin/InstitutionManagement.jsx`) backed by:

- `GET /api/institutions` — list all institutions with their `is_active`
  (qualification) status.
- `PATCH /api/institutions/:id/status` — qualify (`is_active: true`) or
  suspend (`is_active: false`) an institution.

Both endpoints (`institutionController.js`) are restricted to a
`regulatory_body` institution's admin or a `super_admin`, checked against a
fresh DB read. The regulator institution itself cannot be deactivated.

## JWT claims

`institution_code` and `institution_type` are included in the JWT at login
(`authController.login`, joining `institutions`) so the frontend can gate UI
(e.g. show ZAQA's regulator dashboard instead of an issuance form) without an
extra round-trip. These claims are informational for the UI only — every
security-relevant check re-reads the institution from the database.
