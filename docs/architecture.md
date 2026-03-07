# Architecture & Implementation Plan — ClaimFlow AI
## Architect Agent Deliverable

**Version:** 1.0
**Date:** Mars 2026
**Project:** ClaimFlow AI — Auto Insurance Claims Management Platform
**Author:** Agent Architecte (Orchestration Technique)
**Status:** Ready for Development

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Dependencies Graph](#2-module-dependencies-graph)
3. [API Contracts — All 8 Domains](#3-api-contracts--all-8-domains)
4. [Prisma Schema](#4-prisma-schema)
5. [Definition of Done per Epic](#5-definition-of-done-per-epic)
6. [J1–J5 Implementation Plan](#6-j1j5-implementation-plan)
7. [Security Architecture](#7-security-architecture)
8. [Error Codes Reference](#8-error-codes-reference)

---

## 1. Architecture Overview

### 1.1 Stack Summary

| Layer | Technology | Version | Role |
|---|---|---|---|
| Framework | Next.js App Router | 15.x | Pages, API Routes, Server Components — single repo |
| Language | TypeScript strict | 5.x | End-to-end typing; types inferred from Prisma and Zod |
| UI | Tailwind CSS + shadcn/ui | 4.x / latest | Design system; accessible components |
| Charts | Recharts | 2.x | Declarative React charts; responsive containers |
| ORM | Prisma | 6.x | Type-safe queries; declarative migrations; SQLite → PG transparent |
| Database | SQLite (dev) / PostgreSQL (prod) | — | Zero-config local; Neon/Supabase for deployment |
| AI | Anthropic Claude SDK | TS 1.x | claude-sonnet-4-6 for all AI features |
| Auth | NextAuth.js v5 | 5.x | Credentials provider; JWT; route middleware |
| Validation | Zod | 3.x | Runtime schemas; TypeScript inference; React Hook Form integration |
| Unit/Integration Tests | Vitest + Testing Library | latest | Fast tests; coverage measurement; React components |
| E2E Tests | Playwright | latest | Browser scenarios; cross-browser; CI-ready |
| Code Quality | ESLint + Prettier + Husky | latest | Lint + format + pre-commit hooks |

### 1.2 Directory Structure

```
claimflow/
├── prisma/
│   ├── schema.prisma           # Data model definitions
│   ├── migrations/             # Prisma migration files
│   └── seed.ts                 # Database seeding script
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx    # Login page
│   │   ├── claims/
│   │   │   ├── page.tsx        # Claims list
│   │   │   ├── new/
│   │   │   │   └── page.tsx    # New claim form
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Claim detail
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Analytics dashboard
│   │   ├── admin/
│   │   │   └── page.tsx        # Admin panel
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/route.ts
│   │       ├── claims/
│   │       │   ├── route.ts              # GET (list), POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts          # GET, PATCH, DELETE
│   │       │       ├── status/route.ts   # PATCH status
│   │       │       ├── assign/route.ts   # PATCH assign
│   │       │       ├── analyze/route.ts  # POST orchestration
│   │       │       ├── documents/route.ts
│   │       │       └── comments/route.ts
│   │       ├── policyholders/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── documents/
│   │       │   └── [id]/
│   │       │       └── download/route.ts
│   │       ├── ai/
│   │       │   ├── extract/route.ts
│   │       │   ├── fraud/route.ts
│   │       │   ├── estimate/route.ts
│   │       │   └── letter/route.ts
│   │       ├── dashboard/
│   │       │   ├── stats/route.ts
│   │       │   ├── charts/
│   │       │   │   └── timeline/route.ts
│   │       │   └── recent/route.ts
│   │       └── admin/
│   │           ├── users/
│   │           │   ├── route.ts
│   │           │   └── [id]/route.ts
│   │           ├── audit-logs/route.ts
│   │           └── export/route.ts
│   ├── components/
│   │   ├── claims/
│   │   │   ├── ClaimForm/
│   │   │   │   ├── index.tsx             # Main form wrapper
│   │   │   │   ├── StepPolicyholder.tsx
│   │   │   │   ├── StepVehicle.tsx
│   │   │   │   ├── StepCircumstances.tsx
│   │   │   │   └── StepDocuments.tsx
│   │   │   ├── ClaimsTable.tsx
│   │   │   ├── ClaimFilters.tsx
│   │   │   ├── ClaimStatusBadge.tsx
│   │   │   └── ClaimTimeline.tsx
│   │   ├── ai/
│   │   │   ├── AIAnalysisPanel.tsx
│   │   │   ├── FraudScoreCard.tsx
│   │   │   ├── EstimationCard.tsx
│   │   │   └── LetterGenerator.tsx
│   │   ├── dashboard/
│   │   │   ├── StatsCard.tsx
│   │   │   ├── TimelineChart.tsx
│   │   │   └── ClaimTypePieChart.tsx
│   │   └── shared/
│   │       ├── Header.tsx
│   │       ├── RoleBadge.tsx
│   │       └── FileUpload.tsx
│   ├── lib/
│   │   ├── prisma.ts            # Prisma client singleton
│   │   ├── auth.ts              # NextAuth configuration
│   │   ├── ai/
│   │   │   ├── extract.ts       # Extraction service
│   │   │   ├── fraud.ts         # Fraud scoring service
│   │   │   ├── estimate.ts      # Estimation service
│   │   │   └── letter.ts        # Letter generation service
│   │   ├── services/
│   │   │   ├── claims.service.ts
│   │   │   ├── workflow.service.ts
│   │   │   ├── audit.service.ts
│   │   │   └── config.service.ts
│   │   └── utils/
│   │       ├── claim-number.ts  # SIN-YYYY-NNNNN generator
│   │       └── permissions.ts   # Role/permission helpers
│   └── types/
│       ├── index.ts             # Shared TypeScript types
│       ├── api.ts               # API request/response types
│       └── prisma.ts            # Extended Prisma types
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│       └── playwright/
└── middleware.ts                # NextAuth route protection
```

---

## 2. Module Dependencies Graph

The following is a text-format directed dependency graph. Arrows indicate "depends on" (import/consumption relationship).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                              │
│   Anthropic Claude API (claude-sonnet-4-6)     NextAuth v5 (JWT)       │
└──────────────────────┬────────────────────────────────┬────────────────┘
                       │                                │
┌──────────────────────▼────────────────────────────────▼────────────────┐
│                         LIB / SERVICES LAYER                           │
│                                                                         │
│  lib/prisma.ts ◄─────────────────────────────────────────────────────  │
│       ▲                                                                 │
│       │   (all services depend on Prisma)                               │
│       │                                                                 │
│  lib/ai/extract.ts ──────────────────────────────────────────────────  │
│  lib/ai/fraud.ts   ──► Anthropic SDK                                   │
│  lib/ai/estimate.ts ─────────────────────────────────────────────────  │
│  lib/ai/letter.ts  ──────────────────────────────────────────────────  │
│       ▲                                                                 │
│       │                                                                 │
│  lib/services/claims.service.ts ─────► lib/prisma.ts                  │
│                                  ─────► lib/utils/claim-number.ts      │
│                                  ─────► lib/services/audit.service.ts  │
│                                                                         │
│  lib/services/workflow.service.ts ───► lib/prisma.ts                  │
│                                   ───► lib/services/audit.service.ts   │
│                                   ───► lib/services/config.service.ts  │
│                                                                         │
│  lib/services/audit.service.ts ──────► lib/prisma.ts                  │
│                                                                         │
│  lib/services/config.service.ts ─────► lib/prisma.ts                  │
│                                                                         │
│  lib/utils/permissions.ts ───────────► lib/auth.ts                    │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│                          API ROUTES LAYER                               │
│                                                                         │
│  /api/claims ──────────────────────► claims.service.ts                 │
│                                  ──► workflow.service.ts               │
│                                  ──► permissions.ts                    │
│                                                                         │
│  /api/claims/[id]/analyze ─────────► ai/extract.ts                    │
│                              ──────► ai/fraud.ts                       │
│                              ──────► ai/estimate.ts                    │
│                              ──────► claims.service.ts                 │
│                              ──────► audit.service.ts                  │
│                                                                         │
│  /api/ai/* ────────────────────────► ai/*.ts (individual)              │
│  /api/policyholders ───────────────► prisma.ts                         │
│  /api/documents ───────────────────► prisma.ts + fs (disk)             │
│  /api/dashboard/stats ─────────────► prisma.ts (aggregations)          │
│  /api/admin/* ─────────────────────► claims.service.ts                 │
│                              ──────► config.service.ts                 │
│                              ──────► audit.service.ts                  │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│                        COMPONENTS LAYER                                 │
│                                                                         │
│  ClaimForm ──────────────────────── fetch /api/claims (POST)           │
│                                ──── fetch /api/policyholders            │
│                                ──── fetch /api/documents (POST)        │
│                                ──── Zod schemas (src/types/api.ts)     │
│                                                                         │
│  AIAnalysisPanel ───────────────── fetch /api/claims/[id]/analyze     │
│  FraudScoreCard ────────────────── receives AIAnalysis prop            │
│  EstimationCard ────────────────── receives AIAnalysis prop            │
│  LetterGenerator ───────────────── fetch /api/ai/letter                │
│                                                                         │
│  ClaimsTable ───────────────────── fetch /api/claims (GET)             │
│  Dashboard charts ──────────────── fetch /api/dashboard/*              │
│  Admin panel ───────────────────── fetch /api/admin/*                  │
└─────────────────────────────────────────────────────────────────────────┘

LEGEND:
  ──► direct import dependency
  ──── fetch call (HTTP, runtime dependency)
```

---

## 3. API Contracts — All 8 Domains

### Conventions

- All requests and responses use `Content-Type: application/json`.
- All routes are protected by NextAuth session validation (`getServerSession`).
- All route handlers validate input with Zod; invalid input returns `400`.
- Role checks return `403` for unauthorized access.
- Not found resources return `404`.
- All timestamps are ISO 8601 strings.
- Monetary values are integers in euro cents, displayed as formatted strings in the UI.

---

### 3.1 Domain: Auth (`/api/auth`)

Handled by NextAuth v5. Custom endpoints are not needed; the `[...nextauth]` catch-all covers sign-in, sign-out, and session retrieval.

**GET `/api/auth/session`**

Returns the current session for the authenticated user.

```typescript
// Response 200 — Session active
{
  user: {
    id: string,
    email: string,
    name: string,
    role: "HANDLER" | "MANAGER" | "ADMIN"
  },
  expires: string // ISO 8601
}

// Response 200 — No session
{}
```

**POST `/api/auth/signin`** (NextAuth standard)

```typescript
// Request body
{
  email: string,
  password: string,
  csrfToken: string
}

// Response 200 — Redirects to role-based page
// Response 401 — Invalid credentials
// Response 403 — Account deactivated
```

---

### 3.2 Domain: Claims (`/api/claims`)

**Zod Schemas**

```typescript
import { z } from "zod"

export const ClaimStatusEnum = z.enum([
  "DRAFT", "SUBMITTED", "UNDER_REVIEW",
  "INFO_REQUESTED", "APPROVED", "REJECTED", "CLOSED"
])

export const ClaimTypeEnum = z.enum([
  "COLLISION", "THEFT", "GLASS_BREAK",
  "VANDALISM", "FIRE", "NATURAL_DISASTER", "OTHER"
])

export const CreateClaimSchema = z.object({
  policyholderld: z.string().cuid(),
  type: ClaimTypeEnum,
  incidentDate: z.string().datetime(),
  incidentLocation: z.string().min(1).max(500),
  description: z.string().max(10000),
  hasThirdParty: z.boolean().default(false),
  thirdPartyData: z.object({
    name: z.string().optional(),
    vehicle: z.string().optional(),
    phone: z.string().optional(),
    insurance: z.string().optional(),
    plate: z.string()
  }).optional(),
  status: ClaimStatusEnum.default("DRAFT")
})

export const UpdateClaimSchema = CreateClaimSchema.partial()

export const ClaimResponseSchema = z.object({
  id: z.string(),
  claimNumber: z.string().nullable(),
  status: ClaimStatusEnum,
  type: ClaimTypeEnum,
  incidentDate: z.string(),
  incidentLocation: z.string(),
  description: z.string(),
  hasThirdParty: z.boolean(),
  thirdPartyData: z.unknown().nullable(),
  policyholderld: z.string(),
  assignedToId: z.string().nullable(),
  estimatedAmount: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  policyholder: PolicyholderResponseSchema.optional(),
  assignedTo: UserSummarySchema.optional()
})

export const ClaimListQuerySchema = z.object({
  status: ClaimStatusEnum.optional(),
  type: ClaimTypeEnum.optional(),
  assignedToId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
})
```

---

**GET `/api/claims`** — List claims (paginated, filtered)

```
Authorization: Session token (all roles)
Query params: status?, type?, assignedToId?, search?, page?, limit?, dateFrom?, dateTo?
```

```typescript
// Response 200
{
  data: ClaimResponse[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}

// Note: HANDLER role filters automatically to assignedToId = current user
```

---

**POST `/api/claims`** — Create a new claim

```
Authorization: Session token (HANDLER, MANAGER, ADMIN)
Body: CreateClaimSchema
```

```typescript
// Response 201
ClaimResponse

// When status = "SUBMITTED":
//   claimNumber is assigned as SIN-YYYY-NNNNN
//   AuditLog entry created

// Error codes
// 400: Validation error (Zod)
// 400: Incident date in the future
// 404: Policyholder not found
```

---

**GET `/api/claims/[id]`** — Get single claim with full relations

```
Authorization: Session token (HANDLER: own only, MANAGER/ADMIN: all)
```

```typescript
// Response 200
{
  ...ClaimResponse,
  policyholder: PolicyholderResponse,
  assignedTo: UserSummary | null,
  documents: DocumentResponse[],
  aiAnalyses: AIAnalysisResponse[],
  comments: CommentResponse[],
  auditLogs: AuditLogResponse[]
}

// Error codes
// 403: HANDLER accessing a claim not assigned to them
// 404: Claim not found
```

---

**PATCH `/api/claims/[id]`** — Update claim fields

```
Authorization: Session token (HANDLER: own; MANAGER/ADMIN: all)
Body: UpdateClaimSchema (partial)
```

```typescript
// Response 200
ClaimResponse

// Error codes
// 400: Validation error
// 403: Insufficient permissions
// 404: Claim not found
```

---

**DELETE `/api/claims/[id]`** — Soft-delete a claim (DRAFT only)

```
Authorization: Session token (MANAGER, ADMIN only)
```

```typescript
// Response 204 — No content

// Error codes
// 400: Claim is not in DRAFT status — cannot delete
// 403: Insufficient role
// 404: Not found
```

---

**PATCH `/api/claims/[id]/status`** — Transition claim status

```
Authorization: Session token (HANDLER, MANAGER, ADMIN — transitions are role-gated)
Body:
```

```typescript
// Request
const StatusUpdateSchema = z.object({
  status: ClaimStatusEnum,
  reason: z.string().optional() // Required for REJECTED
})

// Response 200
ClaimResponse

// Error codes
// 400: Invalid transition (e.g., APPROVED → SUBMITTED)
// 400: Rejection reason required when transitioning to REJECTED
// 403: Role not permitted to make this transition
// 404: Claim not found
```

---

**PATCH `/api/claims/[id]/assign`** — Assign claim to a handler

```
Authorization: Session token (MANAGER, ADMIN only)
Body:
```

```typescript
// Request
const AssignSchema = z.object({
  assignedToId: z.string().cuid()
})

// Response 200
ClaimResponse

// Side effects:
//   If claim status is SUBMITTED, automatically transitions to UNDER_REVIEW
//   AuditLog entry created: ACTION = ASSIGNMENT

// Error codes
// 400: Target user is deactivated
// 400: Target user ID does not exist
// 403: Insufficient role
// 404: Claim not found
```

---

**POST `/api/claims/[id]/analyze`** — Trigger full AI orchestration

```
Authorization: Session token (HANDLER, MANAGER, ADMIN)
Body: none required (claim data fetched by ID)
```

```typescript
// Response 200
{
  extraction: AIAnalysisResponse,
  fraud: AIAnalysisResponse,
  estimation: AIAnalysisResponse,
  autoApproved: boolean,
  autoEscalated: boolean
}

// Side effects:
//   4 AIAnalysis records created
//   If fraud score > 70: auto-escalate (assign to manager, AuditLog entry)
//   If amount < threshold AND fraud < threshold: auto-approve (AuditLog entry)

// Error codes
// 409: Analysis already in progress for this claim
// 503: Anthropic API unavailable
// 404: Claim not found
```

---

### 3.3 Domain: Policyholders (`/api/policyholders`)

**Zod Schemas**

```typescript
export const CreatePolicyholderSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(20),
  policyNumber: z.string().min(1).max(50),
  vehicleMake: z.string().min(1).max(100),
  vehicleModel: z.string().min(1).max(100),
  vehicleYear: z.number().int().min(1900).max(2100),
  vehiclePlate: z.string().min(1).max(20),
  vehicleArgusValue: z.number().positive(),
  insuranceType: z.enum(["tiers", "tiers_etendu", "tous_risques"]),
  policyStartDate: z.string().datetime()
})

export const PolicyholderResponseSchema = CreatePolicyholderSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})
```

---

**GET `/api/policyholders`** — List/search policyholders

```
Authorization: Session token (all roles)
Query: search? (name, email, or policyNumber), page?, limit?
```

```typescript
// Response 200
{
  data: PolicyholderResponse[],
  pagination: { page, limit, total, totalPages }
}
```

---

**POST `/api/policyholders`** — Create a new policyholder

```
Authorization: Session token (HANDLER, MANAGER, ADMIN)
Body: CreatePolicyholderSchema
```

```typescript
// Response 201
PolicyholderResponse

// Error codes
// 409: policyNumber already exists
```

---

**GET `/api/policyholders/[id]`** — Get a policyholder

```typescript
// Response 200
{
  ...PolicyholderResponse,
  claims: ClaimSummary[] // list of claims for this policyholder
}

// Error codes
// 404: Not found
```

---

**PATCH `/api/policyholders/[id]`** — Update a policyholder

```
Authorization: Session token (HANDLER: own claims' policyholders; MANAGER/ADMIN: all)
Body: CreatePolicyholderSchema.partial()
```

```typescript
// Response 200
PolicyholderResponse
```

---

### 3.4 Domain: Documents (`/api/documents`)

**GET `/api/claims/[id]/documents`** — List documents for a claim

```typescript
// Response 200
{
  data: DocumentResponse[]
}

// DocumentResponse
{
  id: string,
  claimId: string,
  fileName: string,
  fileSize: number,    // bytes
  mimeType: string,
  uploadedAt: string
  // storagePath is NOT exposed to client
}
```

---

**POST `/api/claims/[id]/documents`** — Upload document(s)

```
Authorization: Session token (HANDLER: own; MANAGER/ADMIN: all)
Content-Type: multipart/form-data
Body: files[] (multipart)
```

```typescript
// Server-side validation (enforced independently of client):
//   - Max file size: 10 MB (10 * 1024 * 1024 bytes)
//   - Allowed MIME types: application/pdf, image/jpeg, image/png
//   - Max 20 files per claim

// Response 201
{
  uploaded: DocumentResponse[]
}

// Error codes
// 400: File too large — "Fichier trop volumineux (max 10 Mo)"
// 400: Invalid format — "Format non autorisé (PDF, JPG, PNG uniquement)"
// 400: Max files exceeded — "Nombre maximum de fichiers atteint (20)"
// 403: Insufficient permissions
```

---

**GET `/api/documents/[id]/download`** — Stream a document file

```
Authorization: Session token; role-gated (same rules as parent claim)
```

```typescript
// Response 200
//   Content-Type: [file mimeType]
//   Content-Disposition: attachment; filename="[originalFileName]"
//   Body: file stream

// Error codes
// 403: No access to parent claim
// 404: Document not found
```

---

**DELETE `/api/claims/[id]/documents/[docId]`** — Delete a document

```
Authorization: Session token (HANDLER: own; MANAGER/ADMIN: all)
```

```typescript
// Response 204 — No content
// Also deletes the file from disk (cleanup)

// Error codes
// 403: Insufficient permissions
// 404: Not found
```

---

### 3.5 Domain: Comments (`/api/comments`)

**GET `/api/claims/[id]/comments`** — Get comments for a claim

```typescript
// Response 200
{
  data: CommentResponse[]
}

// CommentResponse
{
  id: string,
  claimId: string,
  content: string,
  createdAt: string,
  author: {
    id: string,
    name: string,
    role: "HANDLER" | "MANAGER" | "ADMIN"
  }
}
```

---

**POST `/api/claims/[id]/comments`** — Add an internal comment

```
Authorization: Session token (all roles)
Body:
```

```typescript
const CreateCommentSchema = z.object({
  content: z.string().min(1).max(5000)
})

// Response 201
CommentResponse

// Error codes
// 400: Empty content
// 403: Insufficient permissions on parent claim
// 404: Claim not found
```

---

### 3.6 Domain: AI (`/api/ai`)

All AI endpoints accept a POST request and return the raw analysis result. They do NOT automatically persist to the database — persistence is handled by the orchestration endpoint `/api/claims/[id]/analyze`.

**Zod Schemas**

```typescript
// Extraction output
export const ExtractionOutputSchema = z.object({
  incidentDate: z.string().nullable(),
  incidentTime: z.string().nullable(),
  location: z.string().nullable(),
  vehicles: z.array(z.object({
    role: z.enum(["insured", "third_party", "witness"]),
    make: z.string().nullable(),
    model: z.string().nullable(),
    damage: z.string().nullable()
  })),
  injuries: z.boolean().nullable(),
  injuryDescription: z.string().nullable(),
  thirdParties: z.array(z.string()),
  policeReportFiled: z.boolean().nullable(),
  weather: z.string().nullable(),
  gaps: z.array(z.string()) // Missing fields
})

// Fraud output
export const FraudOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  risk: z.enum(["low", "moderate", "high", "critical"]),
  factors: z.array(z.object({
    indicator: z.string(),
    triggered: z.boolean(),
    weight: z.number().int(),
    explanation: z.string()
  })),
  summary: z.string(),
  recommendation: z.string()
})

// Estimation output
export const EstimationOutputSchema = z.object({
  estimatedTotal: z.number(),
  breakdown: z.object({
    parts: z.number(),
    labor: z.number(),
    other: z.number()
  }),
  franchise: z.number(),
  netEstimate: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  rangeMin: z.number(),
  rangeMax: z.number(),
  rangeProb: z.number()
})

// Letter output
export const LetterOutputSchema = z.object({
  subject: z.string(),
  body: z.string(),
  closing: z.string(),
  wordCount: z.number().int()
})
```

---

**POST `/api/ai/extract`** — Extract structured data from free text

```typescript
// Request body
const AIExtractRequestSchema = z.object({
  description: z.string().min(1),
  claimContext: z.object({
    type: ClaimTypeEnum,
    incidentDate: z.string(),
    policyholderName: z.string()
  }).optional()
})

// Response 200
{
  output: ExtractionOutput,
  model: string,
  tokensUsed: number,
  durationMs: number
}

// Error codes
// 400: Validation error
// 503: Anthropic API unavailable
```

---

**POST `/api/ai/fraud`** — Score fraud risk for a claim

```typescript
// Request body
const AIFraudRequestSchema = z.object({
  claimId: z.string().cuid(),
  // All context is loaded server-side from claimId
  // Optional overrides for re-analysis with updated data:
  overrides: z.object({
    incidentDate: z.string().optional(),
    declaredAmount: z.number().optional()
  }).optional()
})

// Response 200
{
  output: FraudOutput,
  model: string,
  tokensUsed: number,
  durationMs: number
}

// Error codes
// 404: Claim not found
// 503: Anthropic API unavailable
```

---

**POST `/api/ai/estimate`** — Estimate compensation amount

```typescript
// Request body
const AIEstimateRequestSchema = z.object({
  claimId: z.string().cuid(),
  extractedData: ExtractionOutputSchema.optional() // Use if extraction was just run
})

// Response 200
{
  output: EstimationOutput,
  model: string,
  tokensUsed: number,
  durationMs: number
}

// Error codes
// 400: Insufficient data for estimation (confidence will be "low")
// 404: Claim not found
// 503: Anthropic API unavailable
```

---

**POST `/api/ai/letter`** — Generate a formal letter

```typescript
// Request body
const AILetterRequestSchema = z.object({
  claimId: z.string().cuid(),
  letterType: z.enum([
    "acknowledgment",
    "missing_documents",
    "approval_notification",
    "rejection_notification",
    "information_request"
  ]),
  additionalContext: z.string().optional() // Extra instructions for the letter
})

// Response 200
{
  output: LetterOutput,
  model: string,
  tokensUsed: number,
  durationMs: number
}

// Error codes
// 400: Letter type not appropriate for current claim status
// 404: Claim not found
// 503: Anthropic API unavailable
```

---

### 3.7 Domain: Dashboard (`/api/dashboard`)

**GET `/api/dashboard/stats`** — KPI statistics

```
Authorization: Session token (HANDLER: own data; MANAGER/ADMIN: global)
Query params:
```

```typescript
const DashboardQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
  dateFrom: z.string().datetime().optional(), // Required if period = "custom"
  dateTo: z.string().datetime().optional(),
  handlerId: z.string().optional() // MANAGER/ADMIN only
})

// Response 200
{
  period: {
    label: string,
    from: string,
    to: string
  },
  claims: {
    total: number,
    byStatus: {
      DRAFT: number,
      SUBMITTED: number,
      UNDER_REVIEW: number,
      INFO_REQUESTED: number,
      APPROVED: number,
      REJECTED: number,
      CLOSED: number
    }
  },
  financial: {
    totalEstimatedAmount: number,    // sum of estimatedAmount for APPROVED
    avgEstimatedAmount: number,
    currency: "EUR"
  },
  processing: {
    avgDaysToClose: number | null,   // null if no closed claims
    slaBreached: number              // claims over 48h without action
  },
  fraud: {
    escalatedCount: number,          // fraud score > threshold
    escalationRate: number           // percentage (0-100)
  }
}
```

---

**GET `/api/dashboard/charts/timeline`** — Time-series data for line chart

```
Authorization: Session token (MANAGER, ADMIN only)
Query params: same as /stats
```

```typescript
// Response 200
{
  series: Array<{
    date: string,          // ISO date "2026-01-15"
    submitted: number,
    approved: number,
    rejected: number,
    totalAmount: number
  }>
}
```

---

**GET `/api/dashboard/recent`** — Most recently updated claims

```
Authorization: Session token (HANDLER: own; MANAGER/ADMIN: all)
Query: limit? (default 10, max 50)
```

```typescript
// Response 200
{
  data: Array<{
    id: string,
    claimNumber: string | null,
    status: ClaimStatus,
    type: ClaimType,
    policyholderName: string,
    updatedAt: string,
    assignedToName: string | null,
    fraudScore: number | null
  }>
}
```

---

### 3.8 Domain: Admin (`/api/admin`)

**GET `/api/admin/users`** — List all users

```
Authorization: Session token (ADMIN only)
Query: role?, active?, search?, page?, limit?
```

```typescript
// Response 200
{
  data: Array<{
    id: string,
    email: string,
    name: string,
    role: "HANDLER" | "MANAGER" | "ADMIN",
    active: boolean,
    createdAt: string,
    claimsCount: number  // total claims assigned
  }>,
  pagination: { page, limit, total, totalPages }
}
```

---

**POST `/api/admin/users`** — Create a new user

```
Authorization: Session token (ADMIN only)
Body:
```

```typescript
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["HANDLER", "MANAGER", "ADMIN"]),
  password: z.string().min(8)
})

// Response 201
{
  id: string,
  email: string,
  name: string,
  role: string,
  active: true,
  temporaryPassword: string  // shown once only
}

// Error codes
// 409: Email already in use
```

---

**PATCH `/api/admin/users/[id]`** — Update a user (role, name, active status)

```
Authorization: Session token (ADMIN only)
Body:
```

```typescript
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["HANDLER", "MANAGER", "ADMIN"]).optional(),
  active: z.boolean().optional()
})

// Response 200
{ id, email, name, role, active, updatedAt }

// Error codes
// 400: Admin cannot deactivate own account
// 404: User not found
```

---

**GET `/api/admin/audit-logs`** — Paginated audit log

```
Authorization: Session token (MANAGER: read; ADMIN: read + export)
Query:
```

```typescript
const AuditLogQuerySchema = z.object({
  claimId: z.string().optional(),
  userId: z.string().optional(),
  action: z.enum([
    "STATUS_CHANGE", "ASSIGNMENT", "AI_ANALYSIS", "COMMENT",
    "AUTO_ESCALATION", "AUTO_APPROVAL", "ALERT_48H",
    "DOCUMENT_UPLOAD", "CONFIG_CHANGE"
  ]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(100).default(50)
})

// Response 200
{
  data: Array<{
    id: string,
    claimId: string | null,
    claimNumber: string | null,
    userId: string,
    userName: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
    createdAt: string
  }>,
  pagination: { page, limit, total, totalPages }
}
```

---

**GET `/api/admin/export`** — Export claims data as CSV

```
Authorization: Session token (ADMIN only)
Query:
```

```typescript
const ExportQuerySchema = z.object({
  status: ClaimStatusEnum.optional(),
  type: ClaimTypeEnum.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  handlerId: z.string().optional(),
  target: z.enum(["claims", "audit_logs"]).default("claims")
})

// Response 200
//   Content-Type: text/csv; charset=utf-8
//   Content-Disposition: attachment; filename="claimflow-export-[date].csv"
//   Body: CSV stream (UTF-8 with BOM for Excel)

// CSV columns for "claims" export (in French):
//   Numéro, Statut, Type, Date sinistre, Assuré, Police, Véhicule,
//   Immatriculation, Gestionnaire, Montant estimé, Score fraude,
//   Date création, Date mise à jour

// Error codes
// 400: Custom date range — end before start
```

---

## 4. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      String   @default("HANDLER") // HANDLER | MANAGER | ADMIN
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignedClaims Claim[]    @relation("AssignedTo")
  comments       Comment[]
  auditLogs      AuditLog[]
}

model Policyholder {
  id               String   @id @default(cuid())
  firstName        String
  lastName         String
  email            String
  phone            String
  policyNumber     String   @unique
  vehicleMake      String
  vehicleModel     String
  vehicleYear      Int
  vehiclePlate     String
  vehicleArgusValue Float
  insuranceType    String   // tiers | tiers_etendu | tous_risques
  policyStartDate  DateTime
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  claims Claim[]
}

model Claim {
  id              String   @id @default(cuid())
  claimNumber     String?  @unique // SIN-YYYY-NNNNN, set on SUBMIT
  status          String   @default("DRAFT")
  type            String
  incidentDate    DateTime
  incidentLocation String
  description     String
  hasThirdParty   Boolean  @default(false)
  thirdPartyData  String?  // JSON serialized
  estimatedAmount Float?   // Set after AI estimation/manual approval
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  policyholderld  String
  policyholder    Policyholder @relation(fields: [policyholderld], references: [id])

  assignedToId    String?
  assignedTo      User?   @relation("AssignedTo", fields: [assignedToId], references: [id])

  documents   Document[]
  aiAnalyses  AIAnalysis[]
  comments    Comment[]
  auditLogs   AuditLog[]
}

model Document {
  id          String   @id @default(cuid())
  fileName    String
  fileSize    Int
  mimeType    String
  storagePath String
  uploadedAt  DateTime @default(now())

  claimId String
  claim   Claim  @relation(fields: [claimId], references: [id], onDelete: Cascade)
}

model AIAnalysis {
  id         String   @id @default(cuid())
  type       String   // EXTRACT | FRAUD | ESTIMATE | LETTER
  input      String   // JSON
  output     String   // JSON
  model      String
  tokensUsed Int
  durationMs Int
  createdAt  DateTime @default(now())

  claimId String
  claim   Claim  @relation(fields: [claimId], references: [id], onDelete: Cascade)
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  createdAt DateTime @default(now())

  claimId  String
  claim    Claim  @relation(fields: [claimId], references: [id], onDelete: Cascade)

  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String   // STATUS_CHANGE | ASSIGNMENT | AI_ANALYSIS | etc.
  oldValue  String?  // JSON
  newValue  String?  // JSON
  createdAt DateTime @default(now())

  claimId String?
  claim   Claim?  @relation(fields: [claimId], references: [id])

  userId String
  user   User   @relation(fields: [userId], references: [id])
}

model SystemConfig {
  id        String   @id @default(cuid())
  key       String   @unique // AUTO_APPROVAL_AMOUNT | FRAUD_ESCALATION_SCORE
  value     String
  updatedAt DateTime @updatedAt
  updatedBy String   // User ID
}
```

---

## 5. Definition of Done per Epic

### E1 — Authentication & Roles

- [ ] NextAuth v5 configured with Credentials provider
- [ ] `User` model includes `role` (String enum), `active` (Boolean), `password` (bcrypt)
- [ ] Login page validates email + password with Zod; displays generic error on failure
- [ ] Post-login redirect is role-based: HANDLER → /claims, MANAGER → /dashboard, ADMIN → /admin
- [ ] All API routes check session via `getServerSession`; return 401 if unauthenticated
- [ ] Role-based access returns 403 when insufficient role
- [ ] Deactivated accounts (`active = false`) return 403 at login
- [ ] `middleware.ts` protects all `/claims`, `/dashboard`, `/admin` routes
- [ ] Header component shows authenticated user name and role at all times
- [ ] Clean logout invalidates session and redirects to login
- [ ] Tests: login (valid, invalid, deactivated), role routing, protected route access

---

### E2 — Claim Declaration

- [ ] `Claim`, `Policyholder`, `Document` models migrated and seeded
- [ ] Multi-step form (4 steps) with per-step Zod validation and navigation
- [ ] Step 3 includes third-party conditional fields triggered by checkbox
- [ ] File upload: multi-file, preview, client + server validation (10 MB, PDF/JPG/PNG, max 20 files)
- [ ] Draft save: status = DRAFT, no claim number, resumable
- [ ] Submission: status → SUBMITTED, claim number `SIN-YYYY-NNNNN` generated atomically
- [ ] `POST /api/claims` and `PATCH /api/claims/[id]` validated with Zod
- [ ] `POST /api/claims/[id]/documents` validated server-side independently of client
- [ ] Incident date: future dates rejected; tardiness flag computed for AI
- [ ] Tests: form step navigation, validation, file upload rejection, draft/submit workflow

---

### E3 — AI Analysis

- [ ] All 4 AI service modules: `lib/ai/extract.ts`, `fraud.ts`, `estimate.ts`, `letter.ts`
- [ ] Each service calls `claude-sonnet-4-6` with a specialized system prompt
- [ ] Each service returns structured JSON validated against its Zod output schema
- [ ] On malformed JSON: automatic retry once; if still fails, log and return error response
- [ ] Orchestration endpoint `POST /api/claims/[id]/analyze` calls all 4 in sequence
- [ ] All analyses persisted in `AIAnalysis` with type, input, output, model, tokens, durationMs
- [ ] Auto-approval logic: amount < `AUTO_APPROVAL_AMOUNT` AND fraud < `FRAUD_ESCALATION_SCORE` → status = APPROVED + AuditLog
- [ ] Auto-escalation logic: fraud > `FRAUD_ESCALATION_SCORE` → assign to manager + AuditLog
- [ ] Concurrent analysis protection: 409 if analysis already running for this claim
- [ ] `FraudScoreCard`: gauge (0–100), color-coded (green/orange/red/dark-red), indicator list
- [ ] `EstimationCard`: min/max/probable, breakdown table, franchise, confidence badge
- [ ] `LetterGenerator`: select type, preview, word count displayed, "Valider" action
- [ ] AI history tab: all analyses for a claim, ordered descending by date
- [ ] Tests: extraction parse, fraud boundary conditions (70/71), auto-approval boundary (1999/2000 EUR, 29/30 score), letter generation

---

### E4 — Workflow & Traceability

- [ ] `Comment` and `AuditLog` models migrated
- [ ] All allowed status transitions enforced in `workflow.service.ts`; invalid transitions return 400
- [ ] `PATCH /api/claims/[id]/status`: validates transition, requires reason for REJECTED
- [ ] `PATCH /api/claims/[id]/assign`: updates `assignedToId`, auto-transitions SUBMITTED → UNDER_REVIEW
- [ ] Every status change and assignment creates an `AuditLog` entry with oldValue/newValue
- [ ] HANDLER can only view and edit their assigned claims (enforced server-side)
- [ ] MANAGER/ADMIN can view all claims and all transitions
- [ ] Comments: POST validates non-empty content; GET returns comments with author details
- [ ] 48h alert: scheduled check (or triggered on list fetch) flags claims with ALERT_48H
- [ ] Claims list: filters by status, type, date range, handler, free-text search
- [ ] Claim detail: full audit timeline, comments section, document list, AI analysis panel
- [ ] AuditLog immutability: no DELETE or UPDATE routes implemented for AuditLog
- [ ] Tests: transition validation (all valid + 3 invalid cases), HANDLER access restriction, 48h badge, comment creation

---

### E5 — Dashboard Analytics

- [ ] `GET /api/dashboard/stats` returns KPIs scoped by role (HANDLER = own; MANAGER/ADMIN = global)
- [ ] `GET /api/dashboard/charts/timeline` returns daily aggregates for Recharts
- [ ] `GET /api/dashboard/recent` returns last N updated claims
- [ ] Period filter: 7d, 30d, 90d, custom range; all endpoints respect the filter
- [ ] `StatsCard` component renders KPI with value, label, trend indicator
- [ ] `TimelineChart` renders line chart with Recharts `LineChart` (responsive container)
- [ ] `ClaimTypePieChart` renders `PieChart` with percentage labels
- [ ] HANDLER dashboard shows limited view (own claims only, no handler comparison)
- [ ] Empty state: "Aucune donnée" message when no claims match the period
- [ ] Monetary values formatted as French locale (1 234,56 EUR)
- [ ] Tests: KPI calculation correctness, role-scoped data isolation, empty state rendering

---

### E6 — Administration

- [ ] `SystemConfig` model migrated with seeds: AUTO_APPROVAL_AMOUNT=2000, FRAUD_ESCALATION_SCORE=70
- [ ] `GET /api/admin/users`: paginated user list with claims count
- [ ] `POST /api/admin/users`: creates user with bcrypt password; returns temporary password once
- [ ] `PATCH /api/admin/users/[id]`: updates name, role, active; blocks self-deactivation
- [ ] `GET /api/admin/audit-logs`: paginated, filterable audit log
- [ ] `GET /api/admin/export`: streams UTF-8 BOM CSV with French headers
- [ ] Threshold configuration UI: form with current values, save updates `SystemConfig`; changes logged in AuditLog
- [ ] User management UI: table with role badges, deactivate toggle, role change dropdown
- [ ] All admin routes return 403 for non-ADMIN roles
- [ ] Tests: user CRUD, self-deactivation block, threshold persistence, CSV export structure

---

## 6. J1–J5 Implementation Plan

### Overview

| Day | Theme | Dev A Focus (Backend) | Dev B Focus (Frontend) | Sync |
|---|---|---|---|---|
| J1 | Setup & Foundations | Project init, DB schema, seed | Layout, routing, auth UI | Schema + API contract validation (30 min) |
| J2 | API REST & Base UI | Full CRUD API, integration tests | ClaimsTable, ClaimFilters, ClaimForm (4 steps) | Cross-demo: API + wireframes (30 min) |
| J3 | AI Integration | 4 AI endpoints, orchestration, pre-commit hooks | 4 AI components, MCP barèmes local | Frontend ↔ Backend integration (1h) |
| J4 | Dashboard & Refactoring | Dashboard API, status workflow, CSV export, ai.service refactor | Dashboard Recharts, admin panel, ClaimForm refactor | AI component review in UI (30 min) |
| J5 | Tests & Demo | Coverage > 60%, debugging, code review | 3 Playwright E2E tests, component tests, demo rehearsal | Cross-testing (1h) + demo run-through |

---

### J1 — Setup & Foundations

**Dev A — Backend**

| # | Task | Output | Estimate |
|---|---|---|---|
| A1.1 | Initialize Next.js 15 with TypeScript strict, ESLint, Prettier, Tailwind | Bootstrapped project in `claimflow/` | 30 min |
| A1.2 | Configure Prisma with SQLite, write `schema.prisma` (7 models) | Migrated DB with `prisma migrate dev` | 45 min |
| A1.3 | Write and run `prisma/seed.ts` — 3 users (1 per role) + 10 claims + 5 policyholders | Seeded DB with realistic data | 45 min |
| A1.4 | Configure NextAuth v5 — Credentials provider, JWT, role in token | `lib/auth.ts` functional | 30 min |
| A1.5 | Write `middleware.ts` for route protection | Protected routes redirect to login | 20 min |
| A1.6 | Create `src/types/index.ts` and `src/types/api.ts` — shared TypeScript types | Shared type contract for Dev B | 30 min |

**Dev B — Frontend**

| # | Task | Output | Estimate |
|---|---|---|---|
| B1.1 | Set up shadcn/ui components (Button, Card, Table, Badge, Input, Select) | Component library configured | 30 min |
| B1.2 | Build root layout with Header (user name + role + logout) | `app/layout.tsx` with auth-aware header | 45 min |
| B1.3 | Build Login page with React Hook Form + Zod validation | `/login` page functional with NextAuth | 45 min |
| B1.4 | Build role-based redirect logic (client-side check) | Post-login redirects per role | 20 min |
| B1.5 | Scaffold empty pages: `/claims`, `/claims/new`, `/claims/[id]`, `/dashboard`, `/admin` | Routing structure established | 30 min |
| B1.6 | Consume `src/types/api.ts` — confirm shared type compatibility with A1.6 | No TypeScript errors | 20 min |

**J1 Sync (30 min) — Validate:**
- [ ] DB schema matches both devs' expectations
- [ ] Shared types (`src/types/`) are agreed and committed
- [ ] API base URL and response shapes confirmed

---

### J2 — API REST & Base UI

**Dev A — Backend**

| # | Task | Output | Estimate |
|---|---|---|---|
| A2.1 | Write integration tests (TDD) for `GET /api/claims` — pagination, filtering, role scoping | Red tests written before implementation | 30 min |
| A2.2 | Implement `GET /api/claims` with Zod query validation, role-based scoping | Green tests passing | 45 min |
| A2.3 | Implement `POST /api/claims` — draft and submit, claim number generation | `lib/utils/claim-number.ts` functional | 45 min |
| A2.4 | Implement `GET/PATCH/DELETE /api/claims/[id]` | Full CRUD for claims | 30 min |
| A2.5 | Implement `PATCH /api/claims/[id]/status` — transition validation in `workflow.service.ts` | Invalid transitions return 400 | 45 min |
| A2.6 | Implement `PATCH /api/claims/[id]/assign` — auto status transition + AuditLog | Assignment with audit trail | 30 min |
| A2.7 | Implement `GET/POST /api/policyholders` and `GET/POST /api/claims/[id]/documents` | Document upload with server-side validation | 45 min |
| A2.8 | Implement `GET/POST /api/claims/[id]/comments` | Comments with author | 20 min |

**Dev B — Frontend**

| # | Task | Output | Estimate |
|---|---|---|---|
| B2.1 | Build `ClaimsTable` component — sortable columns, status badge, handler name | Functional table consuming GET /api/claims | 60 min |
| B2.2 | Build `ClaimFilters` component — status dropdown, type dropdown, date pickers, search | Filter state triggers API refetch | 45 min |
| B2.3 | Build `ClaimForm` step 1 (Policyholder) — search existing + create new | Functional with Zod validation | 45 min |
| B2.4 | Build `ClaimForm` step 2 (Vehicle) | Functional with Zod validation | 30 min |
| B2.5 | Build `ClaimForm` step 3 (Circumstances) — incident details + third-party conditional | Conditional fields show/hide correctly | 45 min |
| B2.6 | Build `ClaimForm` step 4 (Documents) — multi-file upload with preview | Client-side size/type validation | 60 min |
| B2.7 | Wire ClaimForm submit → `POST /api/claims` → redirect to claim detail | End-to-end form submission works | 30 min |

**J2 Sync (30 min) — Validate:**
- [ ] Demo GET /api/claims returning paginated results
- [ ] ClaimForm completes all 4 steps and submits without errors
- [ ] Shared types still aligned

---

### J3 — AI Integration

**Dev A — Backend**

| # | Task | Output | Estimate |
|---|---|---|---|
| A3.1 | Implement `lib/ai/extract.ts` — system prompt, Claude call, JSON validation | Extraction service with structured output | 60 min |
| A3.2 | Implement `lib/ai/fraud.ts` — 8 indicators, score calculation, system prompt | Fraud service with score + factors | 60 min |
| A3.3 | Implement `lib/ai/estimate.ts` — barème reference in prompt, confidence levels | Estimation service with breakdown | 45 min |
| A3.4 | Implement `lib/ai/letter.ts` — 5 letter types, French formal tone, 300-word limit | Letter generation service | 30 min |
| A3.5 | Implement `POST /api/claims/[id]/analyze` — orchestration, auto-approve/escalate logic, concurrent protection | Orchestration endpoint with side effects | 60 min |
| A3.6 | Implement individual AI endpoints: `/api/ai/extract`, `/api/ai/fraud`, `/api/ai/estimate`, `/api/ai/letter` | Standalone AI endpoints | 30 min |
| A3.7 | Set up Husky pre-commit hook to validate system prompt JSON structure | Hook running on `git commit` | 20 min |

**Dev B — Frontend**

| # | Task | Output | Estimate |
|---|---|---|---|
| B3.1 | Build `AIAnalysisPanel` — trigger button, loading state, results tabs | Panel consuming POST /api/claims/[id]/analyze | 60 min |
| B3.2 | Build `FraudScoreCard` — gauge visualization, color-coded 4 levels, factor list | Visual fraud score display | 45 min |
| B3.3 | Build `EstimationCard` — min/max/probable display, breakdown table, confidence badge | Estimation results display | 45 min |
| B3.4 | Build `LetterGenerator` — type selector, preview modal, word count, validate action | Letter generation UI | 45 min |
| B3.5 | Integrate AI components into `/claims/[id]` page | Full AI panel visible on claim detail | 45 min |
| B3.6 | Configure MCP local server exposing barèmes (for AI context in estimation) | MCP server running locally | 45 min |

**J3 Sync (1h) — Validate:**
- [ ] End-to-end: click "Lancer l'analyse" on a seeded claim → all 4 results appear
- [ ] Auto-escalation triggers when fraud score injected > 70
- [ ] Auto-approval triggers when amount < 2000 and fraud < 30

---

### J4 — Dashboard & Refactoring

**Dev A — Backend**

| # | Task | Output | Estimate |
|---|---|---|---|
| A4.1 | Implement `GET /api/dashboard/stats` — KPIs with role scoping and period filter | Stats endpoint with all metrics | 60 min |
| A4.2 | Implement `GET /api/dashboard/charts/timeline` — daily aggregates | Time-series data for Recharts | 45 min |
| A4.3 | Implement `GET /api/dashboard/recent` — last N updated claims | Recent claims endpoint | 20 min |
| A4.4 | Implement `GET/POST/PATCH /api/admin/users` — user CRUD with self-deactivation block | Admin user management | 45 min |
| A4.5 | Implement `GET /api/admin/audit-logs` — paginated, filterable | Audit log endpoint | 30 min |
| A4.6 | Implement `GET /api/admin/export` — CSV stream with UTF-8 BOM | Export endpoint | 45 min |
| A4.7 | Refactor `ai.service.ts` → 4 separate files: `extract.ts`, `fraud.ts`, `estimate.ts`, `letter.ts` | Clean separation of AI services | 30 min |

**Dev B — Frontend**

| # | Task | Output | Estimate |
|---|---|---|---|
| B4.1 | Build `StatsCard` component — value, label, trend arrow | Reusable KPI card | 30 min |
| B4.2 | Build `TimelineChart` — Recharts LineChart with responsive container | Line chart consuming /dashboard/charts/timeline | 45 min |
| B4.3 | Build `ClaimTypePieChart` — Recharts PieChart with percentage labels | Pie chart consuming /dashboard/stats | 45 min |
| B4.4 | Assemble `/dashboard` page — KPI grid + charts + period filter | Full dashboard page | 60 min |
| B4.5 | Build `/admin` page — user management table + threshold config form | Admin panel functional | 60 min |
| B4.6 | Refactor `ClaimForm` (400 lines) → 4 step sub-components | `StepPolicyholder`, `StepVehicle`, `StepCircumstances`, `StepDocuments` | 45 min |

**J4 Sync (30 min) — Validate:**
- [ ] Dashboard renders with correct KPIs for seed data
- [ ] AI component display is correct in the full claim detail UI
- [ ] CSV export downloads with correct data

---

### J5 — Tests & Demo

**Dev A — Backend**

| # | Task | Output | Estimate |
|---|---|---|---|
| A5.1 | Implement remaining integration tests: POST /api/claims, status transitions, assign | Test coverage for workflow | 60 min |
| A5.2 | Implement AI service unit tests: fraud boundary (70/71), auto-approval (1999/2000), letter structure | AI boundary condition coverage | 60 min |
| A5.3 | Implement audit log immutability tests | AuditLog tests | 30 min |
| A5.4 | Run `vitest --coverage`; fix coverage gaps to reach > 60% | Coverage report > 60% | 60 min |
| A5.5 | Code review pass: security, error handling, no `any` types, Zod on all endpoints | Review notes resolved | 45 min |
| A5.6 | Debugging: fix issues found by Dev B during E2E runs | Bugs resolved | 30 min |

**Dev B — Frontend**

| # | Task | Output | Estimate |
|---|---|---|---|
| B5.1 | Write Playwright E2E test 1: full login flow (all 3 roles + invalid credentials) | `tests/e2e/auth.spec.ts` green | 45 min |
| B5.2 | Write Playwright E2E test 2: claim creation (4-step form + submit + claim number displayed) | `tests/e2e/claim-creation.spec.ts` green | 60 min |
| B5.3 | Write Playwright E2E test 3: dashboard (login as MANAGER, KPIs visible, period filter works) | `tests/e2e/dashboard.spec.ts` green | 45 min |
| B5.4 | Write component tests: `ClaimForm` (step navigation, validation), `FraudScoreCard` (4 color levels), `StatsCard` (value display) | Component test coverage | 60 min |
| B5.5 | Demo rehearsal: walk through the 7-step demo scenario | Smooth 15-min demo | 45 min |
| B5.6 | Fix UI issues found during E2E runs | Clean UI | 30 min |

**J5 Sync (1h) — Cross-Testing + Demo Rehearsal:**
- [ ] Both devs run each other's tests; all pass
- [ ] Full demo run: login → dashboard → new claim → AI analysis (fraud 72 triggers escalation) → workflow → letter generation → CSV export
- [ ] Coverage report shows > 60%

---

### J5 Demo Scenario (15 minutes)

| Step | Duration | Action | Value Demonstrated |
|---|---|---|---|
| 1. Login | 2 min | Julie (HANDLER) logs in → auto-redirect to /claims | Role-based access differentiated |
| 2. Dashboard | 1 min | Marc (MANAGER) view: KPI cards + line chart + pie chart | Real-time managerial oversight |
| 3. Declaration | 3 min | Julie: 4-step form, upload 2 photos, submit → SIN-2026-NNNNN | Guided structured input in < 3 min |
| 4. AI Analysis | 3 min | 1-click analysis: extraction + fraud score 72 (red alert!) + estimation 3,200 EUR | AI augmenting the handler |
| 5. Workflow | 2 min | Auto-escalation → Marc approves the claim | Automated business rules |
| 6. Letter | 2 min | Generate approval letter in 1 click — preview shows personalized content | Zero manual drafting |
| 7. Export | 2 min | Marc exports filtered CSV of approved claims | Data freely exportable |

---

## 7. Security Architecture

### 7.1 Authentication Flow

```
Client → POST /api/auth/signin (email, password)
       → NextAuth Credentials provider
       → DB lookup: User.findUnique({ where: { email } })
       → bcrypt.compare(password, user.password)
       → Check user.active === true
       → Sign JWT: { id, email, name, role, exp: +8h }
       → Set httpOnly cookie "next-auth.session-token"
       → Return session
```

### 7.2 Authorization on Every API Route

```typescript
// Pattern applied to every API route handler
const session = await getServerSession(authOptions)
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

// Role check example
if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// Scope check example for HANDLER
if (session.user.role === "HANDLER" && claim.assignedToId !== session.user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

### 7.3 Input Validation Pattern

```typescript
// Every API route follows this pattern
const parseResult = RequestSchema.safeParse(await request.json())
if (!parseResult.success) {
  return NextResponse.json(
    { error: "Validation error", details: parseResult.error.flatten() },
    { status: 400 }
  )
}
const validated = parseResult.data
// ... use validated (typed, safe)
```

### 7.4 File Upload Security

```typescript
// Server-side validation — independent of client claims
const MAX_SIZE = 10 * 1024 * 1024  // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"]

for (const file of files) {
  if (file.size > MAX_SIZE) throw new ValidationError("File too large")
  if (!ALLOWED_TYPES.includes(file.type)) throw new ValidationError("Invalid file type")
}
// File is stored with a generated UUID filename, not the original name
// Original filename stored in DB, UUID-named file stored on disk
```

---

## 8. Error Codes Reference

| HTTP Code | Meaning | When Used |
|---|---|---|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST (new resource created) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Zod validation failure; invalid state transition; business rule violation |
| 401 | Unauthorized | No session / expired JWT |
| 403 | Forbidden | Valid session but insufficient role or scope |
| 404 | Not Found | Resource does not exist |
| 405 | Method Not Allowed | Attempting DELETE on immutable resources (AuditLog) |
| 409 | Conflict | Duplicate unique field (email, claimNumber); concurrent analysis in progress |
| 503 | Service Unavailable | Anthropic API unreachable or returning errors |

### Standard Error Response Shape

```typescript
// All error responses follow this shape:
{
  error: string,         // Human-readable message (in French for UI display)
  code?: string,         // Machine-readable error code (optional)
  details?: unknown      // Zod flatten() output or additional context (optional)
}

// Examples
{ "error": "Transition de statut invalide: APPROVED → SUBMITTED" }
{ "error": "Validation error", "details": { "fieldErrors": { "email": ["Invalid email"] } } }
{ "error": "Service IA temporairement indisponible — réessayez dans quelques instants", "code": "AI_UNAVAILABLE" }
{ "error": "Fichier trop volumineux (max 10 Mo)", "code": "FILE_TOO_LARGE" }
```

---

*Architecture v1.0 — ClaimFlow AI — Mars 2026 — Agent Architecte Deliverable*
