# BA Specifications — ClaimFlow AI
## Business Analyst Agent Deliverable

**Version:** 1.0
**Date:** Mars 2026
**Project:** ClaimFlow AI — Auto Insurance Claims Management Platform
**Author:** Agent BA (Business Analyst)
**Status:** Ready for Development

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [E1 — Authentication & Roles](#2-e1--authentication--roles)
3. [E2 — Claim Declaration](#3-e2--claim-declaration)
4. [E3 — AI Analysis](#4-e3--ai-analysis)
5. [E4 — Workflow & Traceability](#5-e4--workflow--traceability)
6. [E5 — Dashboard Analytics](#6-e5--dashboard-analytics)
7. [E6 — Administration](#7-e6--administration)
8. [Cross-Cutting Business Rules](#8-cross-cutting-business-rules)
9. [Global Data Model Summary](#9-global-data-model-summary)

---

## 1. Platform Overview

ClaimFlow AI is an auto insurance claims management platform that augments human claims handlers with AI capabilities. It reduces claim processing time from ~45 minutes to under 10 minutes by automating data extraction, fraud scoring, compensation estimation, and document generation.

### 1.1 Roles & Permissions Matrix

| Action | HANDLER (Gestionnaire) | MANAGER | ADMIN |
|---|---|---|---|
| View claims | Assigned only | All | All |
| Create claim | Yes | Yes | Yes |
| Edit claim | Assigned only | All | All |
| Approve / Reject | No | Yes | Yes |
| Launch AI analysis | Yes | Yes | Yes |
| View dashboard | Limited (own KPIs) | Full | Full |
| Manage users | No | No | Yes |
| Configure thresholds | No | No | Yes |
| Read audit log | No | Read | Read + Export |

### 1.2 Claim Lifecycle State Machine

```
SUBMITTED → UNDER_REVIEW → INFO_REQUESTED → APPROVED
                                           → REJECTED
                                                     → CLOSED
```

All state transitions are logged immutably in the `AuditLog` entity.

### 1.3 Core Business Rules (Platform-Wide)

| Rule | Condition | Automatic Action | Configurable |
|---|---|---|---|
| Auto-approval | Estimated amount < 2,000 EUR AND fraud score < 30 | Status → APPROVED, no handler validation required | Yes (amount threshold) |
| Manager escalation | Fraud score > 70 | Auto-assign to manager, status → UNDER_REVIEW | Yes (score threshold) |
| 48h alert | No action 48h after claim creation | Internal notification to assigned team | No (fixed) |
| Claim numbering | Any new claim submission | Generate SIN-YYYY-NNNNN (auto-incremented per year) | No (fixed format) |

---

## 2. E1 — Authentication & Roles

### 2.1 Epic Summary

| Attribute | Value |
|---|---|
| ID | E1 |
| Title | Authentication & Roles |
| Priority | HIGH |
| User Stories | 5 |
| Core Value | Secure, role-differentiated access |

### 2.2 User Stories

| ID | Story | Key Acceptance Criterion |
|---|---|---|
| US-1.1 | As any user, I want to log in with email/password | Automatic role-based redirect, 8h JWT session |
| US-1.2 | As any user, I want to see my profile and role | Name + role visible in header at all times |
| US-1.3 | As any user, I want to be redirected based on my role | HANDLER → /claims, MANAGER → /dashboard, ADMIN → /admin |
| US-1.4 | As any user, I want to log out cleanly | Session invalidated, redirected to login page |
| US-1.5 | As ADMIN, I want to deactivate user accounts | Inactive account cannot log in, returns 403 |

### 2.3 Business Rules

**BR-1.1 — Session Management**
- JWT tokens have an 8-hour validity window.
- Expired tokens must redirect to the login page without error leaking.
- Sessions are stateless; no server-side session store is required for the POC.

**BR-1.2 — Role-Based Routing**
- Post-login redirect is determined exclusively by the user's `role` field in the database.
- The role cannot be changed by the user themselves; only ADMIN can modify it.
- Routes must be protected at the middleware level (Next.js middleware), not just client-side.

**BR-1.3 — Account Deactivation**
- A deactivated account (`active: false`) is rejected at login with HTTP 403.
- Existing sessions for a deactivated user remain valid until their JWT expires; the backend must validate `active` status on every protected API call.
- Deactivation is a soft-delete: the `User` record is preserved with `active = false`.

**BR-1.4 — Password Policy (MVP)**
- Minimum 8 characters for the POC.
- Passwords are stored as bcrypt hashes (cost factor >= 10).
- No password reset flow in MVP scope (out of scope, noted as post-POC).

### 2.4 Gherkin Acceptance Criteria

```gherkin
Feature: E1 — Authentication & Roles

  Background:
    Given the ClaimFlow AI platform is running
    And the database contains seeded users with roles HANDLER, MANAGER, and ADMIN

  Scenario: US-1.1 — Successful login as HANDLER
    Given a HANDLER user with email "julie@claimflow.fr" and password "securePass123"
    When she submits the login form
    Then she is authenticated with an 8-hour JWT
    And she is redirected to "/claims"
    And the header displays her name and role "Gestionnaire"

  Scenario: US-1.1 — Successful login as MANAGER
    Given a MANAGER user with email "marc@claimflow.fr" and password "managerPass123"
    When he submits the login form
    Then he is authenticated with an 8-hour JWT
    And he is redirected to "/dashboard"

  Scenario: US-1.1 — Successful login as ADMIN
    Given an ADMIN user with email "thomas@claimflow.fr" and password "adminPass123"
    When he submits the login form
    Then he is authenticated with an 8-hour JWT
    And he is redirected to "/admin"

  Scenario: US-1.1 — Login with invalid credentials
    Given no user exists with email "unknown@claimflow.fr"
    When the login form is submitted with that email
    Then a generic error "Identifiants incorrects" is displayed
    And no information about whether the email exists is revealed

  Scenario: US-1.1 — Login with deactivated account
    Given a user account with email "inactive@claimflow.fr" and active = false
    When they attempt to log in with correct credentials
    Then they receive a 403 error "Compte désactivé"
    And they are not authenticated

  Scenario: US-1.3 — Role-based route protection
    Given a HANDLER user is authenticated
    When they attempt to navigate to "/admin"
    Then they are redirected to "/claims"
    And an "Accès refusé" message is shown

  Scenario: US-1.4 — Clean logout
    Given a HANDLER user is logged in
    When she clicks the logout button
    Then her session is invalidated
    And she is redirected to the login page
    And navigating back does not restore the session

  Scenario: US-1.5 — Admin deactivates an account
    Given an ADMIN is authenticated
    And a HANDLER user "julie@claimflow.fr" has active = true
    When the ADMIN sets active = false for that user
    Then julie can no longer log in
    And existing active sessions expire at their normal JWT expiry time
```

### 2.5 Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-1.1 | JWT expires during an active session | User is transparently redirected to login on next API call with a 401 response |
| EC-1.2 | User's role is changed while session is active | The old role persists until the JWT refreshes (next login) — document this limitation |
| EC-1.3 | Admin deactivates their own account | System must prevent this; return 400 with message "Impossible de désactiver son propre compte" |
| EC-1.4 | Concurrent logins from multiple devices | Both sessions are valid until expiry (stateless JWT); this is acceptable for MVP |
| EC-1.5 | User submits login form twice quickly (double-click) | Second submission is ignored; button disabled during request |
| EC-1.6 | Empty email or password fields | Client-side validation blocks submission; no API call made |

### 2.6 Data Model Impacts

**Entity: `User`**

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `email` | String | Unique, indexed |
| `password` | String | bcrypt hash |
| `name` | String | Display name |
| `role` | Enum (HANDLER, MANAGER, ADMIN) | Stored as String in SQLite |
| `active` | Boolean | Default true; false = deactivated |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Relations:**
- `User` → `Claim` (one-to-many, via `assignedTo`)
- `User` → `Comment` (one-to-many, via `authorId`)
- `User` → `AuditLog` (one-to-many, via `userId`)

---

## 3. E2 — Claim Declaration

### 3.1 Epic Summary

| Attribute | Value |
|---|---|
| ID | E2 |
| Title | Claim Declaration |
| Priority | HIGH |
| User Stories | 6 |
| Core Value | Guided, structured data capture for AI quality |

### 3.2 User Stories

| ID | Story | Key Acceptance Criterion |
|---|---|---|
| US-2.1 | As a HANDLER, I want a multi-step form | 4 steps: policyholder, vehicle, circumstances, documents — per-step validation |
| US-2.2 | As a HANDLER, I want to upload photos and documents | Multi-file, preview, max 10 MB/file, PDF/JPG/PNG only |
| US-2.3 | As a HANDLER, I want an auto-generated claim number | Format SIN-YYYY-NNNNN, immutable, generated on submission |
| US-2.4 | As a HANDLER, I want to save as draft | Resume at any time, status "DRAFT" visible |
| US-2.5 | As a HANDLER, I want to enter third-party information | Conditional fields shown only when third party is involved |
| US-2.6 | As a HANDLER, I want to submit and trigger processing | Status → SUBMITTED, acknowledgment letter available in 1 click |

### 3.3 Business Rules

**BR-2.1 — Claim Numbering**
- Format: `SIN-YYYY-NNNNN` where `YYYY` is the current year and `NNNNN` is a zero-padded 5-digit sequence that resets each year.
- The number is generated atomically on submission, not on draft save.
- The claim number is immutable once assigned; it cannot be changed by any user or system process.
- The sequence counter is maintained in the database; concurrent submissions must not produce duplicate numbers (use database-level sequence or transaction lock).

**BR-2.2 — Form Steps**
- Step 1 (Policyholder): policyholder search or creation — name, policy number, contact details.
- Step 2 (Vehicle): registration plate, make, model, year, Argus value, insurance type.
- Step 3 (Circumstances): incident type, incident date/time, location, free-text description (min 50 chars for meaningful AI extraction), third-party flag and details.
- Step 4 (Documents): file upload with preview; required for submission: at least one document or photo.

**BR-2.3 — Draft Behavior**
- A draft is saved with status `DRAFT`.
- Drafts do not have a claim number yet.
- Any HANDLER can resume their own drafts; MANAGERs and ADMINs can see all drafts.
- Drafts older than 30 days are flagged with a visual warning (no automatic deletion in MVP).

**BR-2.4 — Document Constraints**
- Maximum file size: 10 MB per file.
- Accepted formats: PDF, JPG/JPEG, PNG.
- Maximum files per claim: 20.
- Server-side validation must mirror client-side validation; reject with HTTP 400 on violation.
- Files are stored locally on disk in `/uploads/claims/[claimId]/` for the POC.

**BR-2.5 — Incident Date Validation**
- Incident date cannot be in the future.
- Incident date cannot be more than 2 years in the past (statute of limitations).
- If incident date is more than 30 days before the declaration date, the fraud indicator "Déclaration tardive" is flagged (+15 pts).

**BR-2.6 — Third-Party Fields**
- Third-party fields (name, vehicle, contact, insurance) are shown only when the "tiers impliqué" checkbox is checked.
- When third-party is flagged, at least the third-party vehicle registration is required.

### 3.4 Gherkin Acceptance Criteria

```gherkin
Feature: E2 — Claim Declaration

  Background:
    Given a HANDLER user "julie" is authenticated
    And she navigates to "/claims/new"

  Scenario: US-2.1 — Complete 4-step form navigation
    Given the form is on step 1 (Assuré)
    When she fills in all required policyholder fields
    And clicks "Suivant"
    Then the form advances to step 2 (Véhicule)
    And a progress indicator shows "Étape 2/4"
    When she fills in vehicle details and clicks "Suivant"
    Then the form advances to step 3 (Circonstances)
    When she fills in incident details with a description of at least 50 characters
    And clicks "Suivant"
    Then the form advances to step 4 (Documents)

  Scenario: US-2.1 — Step validation prevents progression
    Given the form is on step 1 (Assuré)
    When she leaves the policyholder name empty
    And clicks "Suivant"
    Then she remains on step 1
    And an inline error "Champ requis" is displayed next to the name field

  Scenario: US-2.2 — Document upload with valid files
    Given the form is on step 4 (Documents)
    When she uploads a file "accident.jpg" of 2 MB in JPG format
    Then a thumbnail preview is displayed
    And the file name and size are shown
    And an "X" button allows removal of the file

  Scenario: US-2.2 — Rejection of oversized file
    Given the form is on step 4 (Documents)
    When she uploads a file of 11 MB
    Then an error "Fichier trop volumineux (max 10 Mo)" is displayed
    And the file is not added to the list

  Scenario: US-2.2 — Rejection of invalid file format
    Given the form is on step 4 (Documents)
    When she uploads a file "scan.bmp" in BMP format
    Then an error "Format non autorisé (PDF, JPG, PNG uniquement)" is displayed

  Scenario: US-2.3 — Auto-generated claim number on submission
    Given the form is fully completed across all 4 steps
    When she clicks "Soumettre la déclaration"
    Then the claim is saved with status SUBMITTED
    And a claim number in format "SIN-2026-00001" is assigned
    And the claim number is displayed on the confirmation screen
    And the claim number cannot be edited

  Scenario: US-2.4 — Save as draft
    Given the form is on step 2 with partial data
    When she clicks "Enregistrer en brouillon"
    Then the claim is saved with status DRAFT
    And no claim number is assigned
    And she can navigate away and return to resume the form

  Scenario: US-2.5 — Third-party conditional fields
    Given the form is on step 3 (Circonstances)
    When the "Tiers impliqué" checkbox is unchecked
    Then no third-party fields are visible
    When she checks "Tiers impliqué"
    Then third-party fields (name, vehicle, contact, insurance) appear
    And "Immatriculation du tiers" is marked as required

  Scenario: US-2.6 — Submit and trigger processing
    Given a fully completed form
    When she submits the declaration
    Then the status transitions to SUBMITTED
    And an "Accusé de réception" button appears on the claim detail page
    When she clicks "Accusé de réception"
    Then an AI-generated acknowledgment letter is displayed in preview
```

### 3.5 Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-2.1 | Incident date is today | Valid; no tardiness flag |
| EC-2.2 | Incident date is 31 days ago | Valid submission; fraud indicator "Déclaration tardive" silently flagged for AI scoring |
| EC-2.3 | Incident date is in the future | Form validation error: "La date du sinistre ne peut pas être dans le futur" |
| EC-2.4 | Description is exactly 49 characters | No blocking error, but AI extraction will flag "Description vague" (+10 pts fraud indicator) |
| EC-2.5 | User uploads 20 files then tries a 21st | Error: "Nombre maximum de fichiers atteint (20)" |
| EC-2.6 | User navigates back in browser during form | Current step data preserved via form state; no data lost |
| EC-2.7 | Concurrent submission of two claims by same user | Both are accepted; sequential claim numbers assigned atomically |
| EC-2.8 | Policyholder already exists in database | Search returns existing record; handler selects it rather than creating a duplicate |
| EC-2.9 | Network error during file upload | Error message displayed; file must be re-uploaded; partial uploads are cleaned up |
| EC-2.10 | Claim number counter reaches 99999 in a year | System rolls over to next sequence; alert sent to ADMIN |

### 3.6 Data Model Impacts

**Entity: `Claim`**

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `claimNumber` | String | Unique, format SIN-YYYY-NNNNN, assigned on SUBMIT |
| `status` | Enum | DRAFT, SUBMITTED, UNDER_REVIEW, INFO_REQUESTED, APPROVED, REJECTED, CLOSED |
| `type` | Enum | COLLISION, THEFT, GLASS_BREAK, VANDALISM, FIRE, NATURAL_DISASTER, OTHER |
| `incidentDate` | DateTime | When the incident occurred |
| `incidentLocation` | String | Free text location |
| `description` | String | Free text, min 50 chars recommended for AI |
| `hasThirdParty` | Boolean | Flag for third-party involvement |
| `thirdPartyData` | String (JSON) | Serialized third-party details (SQLite) |
| `policyholderld` | String | FK → Policyholder |
| `assignedToId` | String? | FK → User (nullable) |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Entity: `Policyholder`**

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `firstName` | String | |
| `lastName` | String | |
| `email` | String | |
| `phone` | String | |
| `policyNumber` | String | Unique contract identifier |
| `vehicleMake` | String | |
| `vehicleModel` | String | |
| `vehicleYear` | Int | |
| `vehiclePlate` | String | |
| `vehicleArgusValue` | Float | Argus valuation for indemnization |
| `insuranceType` | String | "tiers", "tiers_etendu", "tous_risques" |
| `policyStartDate` | DateTime | Used for "recently insured" fraud check |

**Entity: `Document`**

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `claimId` | String | FK → Claim (cascade delete) |
| `fileName` | String | Original filename |
| `fileSize` | Int | In bytes |
| `mimeType` | String | "application/pdf", "image/jpeg", "image/png" |
| `storagePath` | String | Relative path from uploads root |
| `uploadedAt` | DateTime | Auto-set |

---

## 4. E3 — AI Analysis

### 4.1 Epic Summary

| Attribute | Value |
|---|---|
| ID | E3 |
| Title | AI Analysis |
| Priority | HIGH |
| User Stories | 6 |
| Core Value | AI augmentation of handlers for extraction, fraud, estimation, and correspondence |

### 4.2 User Stories

| ID | Story | Key Acceptance Criterion |
|---|---|---|
| US-3.1 | As a HANDLER, I want to launch AI analysis in 1 click | Full results in < 10s; button disabled during analysis |
| US-3.2 | As a HANDLER, I want to see auto-extracted data | Dedicated panel; editable fields; gaps flagged |
| US-3.3 | As a HANDLER, I want a fraud score with visual indicators | 0–100 gauge; color coding; list of detected indicators |
| US-3.4 | As a HANDLER, I want a compensation estimate | Min/max/probable; breakdown by category; deducted deductible |
| US-3.5 | As a HANDLER, I want to generate an automatic letter | Select letter type; preview before send; 5 types available |
| US-3.6 | As any user, I want a history of AI analyses | All analyses logged with date, model, and tokens consumed |

### 4.3 Business Rules

**BR-3.1 — AI Orchestration**
- The endpoint `POST /api/claims/[id]/analyze` orchestrates all 4 AI calls in sequence.
- Each call uses `claude-sonnet-4-6` model.
- All 4 analyses are stored in the `AIAnalysis` table with their type, input, output JSON, token count, and duration.
- Individual calls can also be triggered via `/api/ai/extract`, `/api/ai/fraud`, `/api/ai/estimate`, `/api/ai/letter`.

**BR-3.2 — Information Extraction Rules**
- The AI must extract: incident date, time, location, vehicles involved (role/make/damage), injuries, third parties, police report filed, weather conditions.
- The AI must flag all gaps (missing fields) in the `gaps` array of the output JSON.
- The AI must never invent data not present in the description (strict rule enforced in system prompt).
- Extracted data is displayed in an editable panel; the handler can correct AI mistakes before proceeding.

**BR-3.3 — Fraud Scoring Rules**

| Indicator | Detection Logic | Weight |
|---|---|---|
| Late declaration | Incident declared > 30 days after the fact | +15 pts |
| Claims history | 3+ claims in the last 12 months (same policyholder) | +20 pts |
| Disproportionate amount | Declared amount > 2× Argus vehicle value | +25 pts |
| Vague description | Free text < 50 characters | +10 pts |
| Recently insured vehicle | Policy subscribed < 3 months before incident | +15 pts |
| No witnesses | Collision declared without witness or police | +10 pts |
| Suspicious geographic zone | Incident in a high-fraud-density area | +10 pts |
| Atypical schedule | Incident between 1:00 and 5:00 AM | +5 pts |

| Score Range | Risk Level | Display | Automatic Action |
|---|---|---|---|
| 0–30 | Low | Green | Normal processing; auto-approval possible |
| 31–60 | Moderate | Orange | Verification recommended; no auto-escalation |
| 61–80 | High | Red | Auto-escalate to manager; investigation required |
| 81–100 | Critical | Dark Red | Block + urgent escalation + possible reporting |

**BR-3.4 — Compensation Estimation Rules**
- Estimation is based on the official French auto insurance schedule (barème) 2025–2026.
- Output must include: `estimatedTotal`, `breakdown` (parts, labor, other), `franchise`, `netEstimate`, `confidence` (low/medium/high).
- Confidence is `high` when all key damage fields are present, `medium` when partial, `low` when insufficient data.
- The estimate is advisory only; the final approved amount is set by the MANAGER.

**BR-3.5 — Letter Generation Rules**
- 5 letter types available: acknowledgment receipt, missing documents request, approval notification, rejection notification, information request.
- All letters are generated in formal French ("français soutenu").
- Letters must be personalized with the policyholder's name and claim number.
- Maximum 300 words per letter.
- The letter is shown in preview before any action; the handler validates before sending.
- Ethical constraint: fraud scoring output must never label a policyholder as "fraudeur"; the score indicates areas to investigate, not guilt.

**BR-3.6 — Analysis History**
- Every AI call is stored in `AIAnalysis` with: `type` (EXTRACT/FRAUD/ESTIMATE/LETTER), `input` (JSON), `output` (JSON), `model`, `tokensUsed`, `durationMs`, `createdAt`.
- Analysis history is visible on the claim detail page, ordered by date descending.
- History is read-only; past analyses cannot be deleted by any role.

### 4.4 Gherkin Acceptance Criteria

```gherkin
Feature: E3 — AI Analysis

  Background:
    Given a HANDLER "julie" is authenticated
    And a claim "SIN-2026-00042" exists with status SUBMITTED
    And the claim has a description of at least 50 characters
    And the ANTHROPIC_API_KEY environment variable is configured

  Scenario: US-3.1 — Launch full AI analysis in 1 click
    Given the claim detail page for "SIN-2026-00042" is open
    When julie clicks "Lancer l'analyse IA"
    Then the button is disabled and shows "Analyse en cours..."
    And within 10 seconds, results appear in the AI analysis panel
    And the button is re-enabled with label "Relancer l'analyse"

  Scenario: US-3.2 — Extracted data is displayed and editable
    Given the AI analysis has completed
    Then the "Données extraites" panel shows: date, location, vehicles, damage description
    And any missing fields show a warning "Donnée manquante"
    When julie corrects an extracted field
    Then the corrected value is preserved in the form state

  Scenario: US-3.3 — Fraud score display for low risk
    Given the AI analysis returned a fraud score of 22
    Then the fraud gauge shows 22/100 in green
    And the label reads "Risque faible"
    And no escalation action is triggered

  Scenario: US-3.3 — Fraud score display and auto-escalation for high risk
    Given the AI analysis returned a fraud score of 75
    Then the fraud gauge shows 75/100 in red
    And the label reads "Risque élevé — Escalade automatique"
    And the claim is automatically assigned to a MANAGER
    And an audit log entry records the escalation with reason "fraud_score_threshold"

  Scenario: US-3.3 — Fraud score breakdown
    Given the fraud score is 45
    Then the indicators panel lists each triggered indicator with its weight
    And the recommendation text says "Vérification recommandée"

  Scenario: US-3.4 — Compensation estimate display
    Given the AI analysis returned an estimate
    Then the "Estimation d'indemnisation" card shows:
      | Field       | Example Value   |
      | Minimum     | 1,200 EUR       |
      | Probable    | 1,800 EUR       |
      | Maximum     | 2,400 EUR       |
      | Franchise   | 300 EUR         |
      | Net         | 1,500 EUR       |
      | Confidence  | Medium          |
    And the breakdown shows line items for "Carrosserie", "Main d'oeuvre", "Autre"

  Scenario: US-3.5 — Generate acknowledgment letter
    Given the claim detail page is open
    When julie selects letter type "Accusé de réception"
    And clicks "Générer le courrier"
    Then a letter preview appears within 5 seconds
    And the letter begins with the policyholder's name
    And includes the claim number "SIN-2026-00042"
    And is written in formal French
    And does not exceed 300 words
    When julie clicks "Valider et envoyer"
    Then the letter is marked as sent in the audit log

  Scenario: US-3.6 — AI analysis history is logged
    Given three AI analyses have been run on "SIN-2026-00042"
    When julie opens the "Historique IA" tab
    Then she sees 3 entries ordered by most recent first
    And each entry shows: type, date/time, model used, tokens consumed, duration in ms

  Scenario: US-3.1 — Auto-approval triggered by analysis
    Given the claim description is minimal but complete
    And the fraud score returned is 18
    And the estimated amount returned is 1,500 EUR
    Then the claim status automatically transitions to APPROVED
    And an audit log entry records "auto_approval" with the score and amount values
    And julie sees a green banner "Dossier approuvé automatiquement"
```

### 4.5 Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-3.1 | Anthropic API is unavailable | Show error "Service IA temporairement indisponible — réessayez dans quelques instants"; claim status unchanged |
| EC-3.2 | AI returns malformed JSON | Retry once automatically; if still malformed, log raw response and show "Erreur d'analyse — contactez le support" |
| EC-3.3 | Description is exactly 0 characters | Extraction returns all fields as null with all gaps flagged; fraud indicator "Description vague" triggered |
| EC-3.4 | Fraud score is exactly 70 | No auto-escalation (threshold is strictly > 70); "Risque élevé" displayed in orange |
| EC-3.5 | Fraud score is exactly 71 | Auto-escalation triggered; boundary condition must be tested explicitly |
| EC-3.6 | Amount is exactly 2,000 EUR with fraud score 29 | No auto-approval (threshold is strictly < 2,000); handled manually |
| EC-3.7 | Amount is exactly 1,999 EUR with fraud score 30 | No auto-approval (fraud score must be strictly < 30); handled manually |
| EC-3.8 | Amount is 1,999 EUR with fraud score 29 | Auto-approval triggered |
| EC-3.9 | Analysis launched while previous analysis is still running | Button remains disabled; second call is blocked with 409 Conflict |
| EC-3.10 | Letter generated for a REJECTED claim | All 5 letter types remain available; system does not restrict generation by status |

### 4.6 Data Model Impacts

**Entity: `AIAnalysis`**

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `claimId` | String | FK → Claim |
| `type` | Enum | EXTRACT, FRAUD, ESTIMATE, LETTER |
| `input` | String (JSON) | Serialized input sent to Claude |
| `output` | String (JSON) | Serialized response from Claude |
| `model` | String | e.g., "claude-sonnet-4-6" |
| `tokensUsed` | Int | Total tokens consumed |
| `durationMs` | Int | Elapsed time in milliseconds |
| `createdAt` | DateTime | Auto-set |

---

## 5. E4 — Workflow & Traceability

### 5.1 Epic Summary

| Attribute | Value |
|---|---|
| ID | E4 |
| Title | Workflow & Traceability |
| Priority | HIGH |
| User Stories | 6 |
| Core Value | Controlled, fully audited claim lifecycle |

### 5.2 User Stories

| ID | Story | Key Acceptance Criterion |
|---|---|---|
| US-4.1 | As any user, I want to see a filtered list of claims | Filters: status, type, date, handler, free-text search |
| US-4.2 | As MANAGER/ADMIN, I want to change claim status | Valid transitions only; invalid ones are blocked |
| US-4.3 | As MANAGER/ADMIN, I want to assign a claim to a handler | Status → UNDER_REVIEW; handler notified |
| US-4.4 | As any user, I want to add internal comments | Timestamped; author traced; not visible to policyholder |
| US-4.5 | As MANAGER/ADMIN, I want to view full audit history | Every action logged: author, date, before/after; read-only |
| US-4.6 | Auto-escalate on fraud score > 70 | Auto-assign to manager; notification; status updated |

### 5.3 Business Rules

**BR-4.1 — Allowed Status Transitions**

| From | To | Condition | Actor |
|---|---|---|---|
| SUBMITTED | UNDER_REVIEW | Assignment to a handler | MANAGER or system |
| UNDER_REVIEW | INFO_REQUESTED | Missing documents detected | HANDLER |
| UNDER_REVIEW | APPROVED | Complete file + validated amount (or auto-approval) | HANDLER/system |
| UNDER_REVIEW | REJECTED | Rejection reason documented | HANDLER |
| INFO_REQUESTED | UNDER_REVIEW | Supplementary documents received | HANDLER |
| APPROVED | CLOSED | Compensation paid | System |
| REJECTED | CLOSED | Contest period expired (30 days) | System |

Any transition not listed above must be rejected with HTTP 400 and a message describing the invalid transition.

**BR-4.2 — Assignment Rules**
- A claim can only be assigned to an active HANDLER or MANAGER.
- When a claim is assigned, the `assignedToId` is updated and the status automatically transitions to `UNDER_REVIEW` if it was `SUBMITTED`.
- A HANDLER can see only their assigned claims; a MANAGER/ADMIN sees all.
- Re-assignment (changing the assigned handler) is allowed; a new AuditLog entry is created.

**BR-4.3 — Audit Log Rules**
- Every status transition, assignment change, and AI analysis launch is recorded in `AuditLog`.
- Each log entry contains: `action` (enum), `userId`, `claimId`, `oldValue` (JSON), `newValue` (JSON), `createdAt`.
- The audit log is immutable: no UPDATE or DELETE is permitted on any `AuditLog` row.
- The audit log is visible to MANAGER and ADMIN roles; exportable by ADMIN only.

**BR-4.4 — Comment Rules**
- Comments are internal only and are never exposed to the policyholder.
- Each comment records: `content`, `authorId`, `claimId`, `createdAt`.
- Comments cannot be edited or deleted after creation.
- There is no character limit on comments (MVP), but the UI recommends keeping them concise.

**BR-4.5 — 48-Hour Alert Rule**
- If a claim remains in `SUBMITTED` or `UNDER_REVIEW` status for 48 hours with no action (no status change, no comment, no assignment), an internal alert is triggered.
- Alert is recorded as an `AuditLog` entry with `action = ALERT_48H`.
- The alert surfaces as a visual badge on the claim in the claims list.

### 5.4 Gherkin Acceptance Criteria

```gherkin
Feature: E4 — Workflow & Traceability

  Background:
    Given a MANAGER "marc" and a HANDLER "julie" are registered
    And a claim "SIN-2026-00010" exists with status SUBMITTED

  Scenario: US-4.1 — HANDLER sees only assigned claims
    Given julie is assigned to claims SIN-2026-00010 and SIN-2026-00011
    And SIN-2026-00012 is assigned to another handler
    When julie navigates to "/claims"
    Then she sees only SIN-2026-00010 and SIN-2026-00011
    And SIN-2026-00012 is not in the list

  Scenario: US-4.1 — Filter claims by status
    Given the claims list contains claims with various statuses
    When julie applies the filter "Statut: UNDER_REVIEW"
    Then only claims with status UNDER_REVIEW are displayed

  Scenario: US-4.1 — Free-text search on claims
    When marc searches for "SIN-2026-00010"
    Then that specific claim appears in the results
    When marc searches for "collision"
    Then all claims with "collision" in the description are shown

  Scenario: US-4.2 — Valid status transition
    Given marc is authenticated
    And "SIN-2026-00010" is in status UNDER_REVIEW
    When marc changes the status to APPROVED with a note
    Then the claim status updates to APPROVED
    And an AuditLog entry records the transition with oldValue=UNDER_REVIEW and newValue=APPROVED

  Scenario: US-4.2 — Invalid status transition is blocked
    Given "SIN-2026-00010" is in status APPROVED
    When marc attempts to change the status to SUBMITTED
    Then the API returns 400 with "Transition de statut invalide: APPROVED → SUBMITTED"
    And the claim status remains APPROVED

  Scenario: US-4.3 — Assign claim to handler
    Given "SIN-2026-00010" has no assigned handler (status SUBMITTED)
    When marc assigns it to julie
    Then the claim status transitions to UNDER_REVIEW
    And the `assignedToId` is set to julie's ID
    And an AuditLog entry records the assignment

  Scenario: US-4.4 — Add internal comment
    Given julie is viewing claim "SIN-2026-00010"
    When she adds a comment "Documents reçus, analyse en cours"
    Then the comment appears in the comments section with julie's name and current timestamp
    And the comment is not visible to the policyholder

  Scenario: US-4.5 — View full audit history
    Given marc navigates to the audit trail of "SIN-2026-00010"
    Then he sees all events in chronological order:
      | Action          | Actor | Old Value  | New Value    |
      | STATUS_CHANGE   | system| SUBMITTED  | UNDER_REVIEW |
      | ASSIGNMENT      | marc  | null       | julie        |
      | AI_ANALYSIS     | julie | null       | FRAUD:62     |
    And no entry can be edited or deleted

  Scenario: US-4.6 — Auto-escalation on fraud score > 70
    Given the AI analysis for "SIN-2026-00010" returns a fraud score of 75
    Then the claim is automatically assigned to marc (MANAGER)
    And the status is updated to UNDER_REVIEW if not already
    And an AuditLog entry records "AUTO_ESCALATION" with fraud_score=75
    And marc sees a red badge on the claim in his dashboard

  Scenario: US-4.5 — 48h alert badge
    Given "SIN-2026-00020" has been in SUBMITTED status for 49 hours with no action
    When any user views the claims list
    Then claim SIN-2026-00020 displays a "48h" warning badge in orange
    And an AuditLog entry with action ALERT_48H has been created
```

### 5.5 Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-4.1 | Fraud score is exactly 70 | No auto-escalation (threshold > 70); orange indicator only |
| EC-4.2 | HANDLER attempts a status change reserved for MANAGER | API returns 403 "Permissions insuffisantes pour cette transition" |
| EC-4.3 | Claim is assigned to a deactivated handler | 400 error: "L'utilisateur cible n'est pas actif"; assignment blocked |
| EC-4.4 | Two managers simultaneously assign the same claim | Last write wins; both actions logged; audit trail shows both events |
| EC-4.5 | APPROVED → CLOSED triggered before payment confirmed | System-only transition; no UI button for this; triggered by payment hook (post-POC) |
| EC-4.6 | Comment with empty content | Client-side and server-side validation block submission; 400 returned |
| EC-4.7 | AuditLog record deletion attempted via direct API call | DELETE on /api/audit-logs is not implemented; returns 405 Method Not Allowed |

### 5.6 Data Model Impacts

**Entity: `Comment`**

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `claimId` | String | FK → Claim |
| `authorId` | String | FK → User |
| `content` | String | Free text |
| `createdAt` | DateTime | Auto-set |

**Entity: `AuditLog`**

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `claimId` | String | FK → Claim |
| `userId` | String | FK → User (actor) |
| `action` | Enum | STATUS_CHANGE, ASSIGNMENT, AI_ANALYSIS, COMMENT, AUTO_ESCALATION, AUTO_APPROVAL, ALERT_48H, DOCUMENT_UPLOAD |
| `oldValue` | String (JSON) | State before the action |
| `newValue` | String (JSON) | State after the action |
| `createdAt` | DateTime | Auto-set, immutable |

---

## 6. E5 — Dashboard Analytics

### 6.1 Epic Summary

| Attribute | Value |
|---|---|
| ID | E5 |
| Title | Dashboard Analytics |
| Priority | MEDIUM |
| User Stories | 5 |
| Core Value | Real-time managerial oversight via KPIs and charts |

### 6.2 User Stories

| ID | Story | Key Acceptance Criterion |
|---|---|---|
| US-5.1 | As MANAGER/ADMIN, I want real-time KPIs | Count by status, total amount, avg processing time, fraud rate |
| US-5.2 | As MANAGER/ADMIN, I want a monthly evolution chart | Line chart with Recharts, filterable by period |
| US-5.3 | As MANAGER/ADMIN, I want a claim type breakdown chart | Pie chart with percentages |
| US-5.4 | As MANAGER/ADMIN, I want to filter by period | Presets: 7d, 30d, 90d + custom range |
| US-5.5 | As HANDLER, I want a limited view of my own KPIs | Own claims only: count by status, avg processing time |

### 6.3 Business Rules

**BR-5.1 — KPI Definitions**

| KPI | Calculation | Scope |
|---|---|---|
| Total claims | COUNT(*) | By status, filtered period |
| Total estimated amount | SUM(estimatedAmount) for APPROVED claims | Filtered period |
| Average processing time | AVG(updatedAt - createdAt) for APPROVED/REJECTED claims | Filtered period |
| Fraud rate | COUNT(claims with fraud_score > 70) / COUNT(*) | Filtered period |
| Handler performance | Claims processed per handler in the period | MANAGER/ADMIN only |

**BR-5.2 — Default Dashboard View**
- Default period: last 30 days.
- KPI cards refresh on page load; no auto-polling in MVP.
- Charts use Recharts library with responsive containers.
- All monetary values displayed in EUR with 2 decimal places and French locale formatting.

**BR-5.3 — HANDLER Dashboard Restriction**
- HANDLERs see only KPIs for their assigned claims.
- HANDLERs cannot see data for other handlers.
- The `/api/dashboard/stats` endpoint respects the caller's role; the query scope is filtered server-side.

### 6.4 Gherkin Acceptance Criteria

```gherkin
Feature: E5 — Dashboard Analytics

  Background:
    Given marc (MANAGER) is authenticated
    And the database contains 50 claims across various statuses and types

  Scenario: US-5.1 — KPI cards display correct values
    When marc navigates to "/dashboard"
    Then he sees KPI cards showing:
      | KPI                      | Value (example) |
      | Sinistres soumis         | 12              |
      | Sinistres en cours       | 18              |
      | Sinistres approuvés      | 15              |
      | Montant total (30j)      | 42,500.00 EUR   |
      | Délai moyen traitement   | 3.2 jours       |
      | Taux de fraude détectée  | 8%              |

  Scenario: US-5.2 — Monthly evolution line chart
    When marc views the dashboard with the "30 derniers jours" filter
    Then a line chart displays daily submission counts over the period
    And each data point shows: date, count, total amount on hover

  Scenario: US-5.3 — Claim type breakdown pie chart
    When marc views the dashboard
    Then a pie chart shows percentages for each claim type:
      COLLISION, THEFT, GLASS_BREAK, VANDALISM, FIRE, NATURAL_DISASTER, OTHER
    And hovering over a segment shows the count and percentage

  Scenario: US-5.4 — Period filter changes all KPIs and charts
    Given the dashboard is showing the 30-day view
    When marc changes the filter to "7 derniers jours"
    Then all KPI cards and charts update to reflect only the last 7 days of data

  Scenario: US-5.4 — Custom date range
    When marc sets a custom range from "2026-01-01" to "2026-01-31"
    Then the dashboard shows only claims from January 2026

  Scenario: US-5.5 — HANDLER sees limited dashboard
    Given julie (HANDLER) is authenticated
    When she navigates to "/dashboard"
    Then she sees only KPIs for her assigned claims
    And there is no "Vue globale" or handler comparison section
```

### 6.5 Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-5.1 | No claims in the selected period | KPIs show 0; charts display empty state message "Aucune donnée pour cette période" |
| EC-5.2 | Custom date range: end before start | Validation error: "La date de fin doit être postérieure à la date de début" |
| EC-5.3 | Average processing time when no claims are closed | KPI shows "N/A" |
| EC-5.4 | Very large dataset (10,000+ claims) | API uses pagination/aggregation; response time remains < 2s |

### 6.6 Data Model Impacts

No new entities required. Dashboard data is computed from existing `Claim`, `AIAnalysis`, and `AuditLog` entities via aggregation queries.

---

## 7. E6 — Administration

### 7.1 Epic Summary

| Attribute | Value |
|---|---|
| ID | E6 |
| Title | Administration |
| Priority | LOW |
| User Stories | 5 |
| Core Value | Autonomous platform configuration without code deployment |

### 7.2 User Stories

| ID | Story | Key Acceptance Criterion |
|---|---|---|
| US-6.1 | As ADMIN, I want full user CRUD | Create, edit, deactivate users; assign roles |
| US-6.2 | As ADMIN, I want to configure business thresholds via UI | Auto-approval amount threshold; fraud escalation score threshold |
| US-6.3 | As ADMIN, I want to export data as CSV | Filterable export; all columns; UTF-8; on-demand |
| US-6.4 | As ADMIN, I want to view the full audit log | Paginated; filterable by user, action, date |
| US-6.5 | As ADMIN, I want to create and seed initial users | Seeded admin/manager/handler accounts for demo |

### 7.3 Business Rules

**BR-6.1 — User Management**
- ADMIN can create users with any role (HANDLER, MANAGER, ADMIN).
- ADMIN can modify a user's name, email, and role.
- ADMIN cannot delete users; only deactivate them (soft-delete).
- ADMIN cannot deactivate their own account (see EC-1.3).
- Email must be unique across all users; duplicate email returns 409 Conflict.
- When creating a user, a temporary password is generated; no email sending in MVP (password displayed once in UI).

**BR-6.2 — Threshold Configuration**
- Two configurable thresholds stored in a `SystemConfig` key-value table:
  1. `AUTO_APPROVAL_AMOUNT` (default: 2000, in EUR)
  2. `FRAUD_ESCALATION_SCORE` (default: 70, 0–100 integer)
- Changes to thresholds take effect immediately for all subsequent AI analyses.
- Changes to thresholds do not retroactively affect already-processed claims.
- Threshold changes are recorded in the `AuditLog`.

**BR-6.3 — CSV Export**
- Export covers the `Claim` table joined with `Policyholder` and `User` (handler).
- Filters available: date range, status, claim type, handler.
- Encoding: UTF-8 with BOM for Excel compatibility.
- Column headers in French.
- Export is triggered on demand (not scheduled).
- Large exports (> 10,000 rows) stream the response to avoid timeout.

**BR-6.4 — Audit Log Access**
- Paginated at 50 entries per page.
- Filterable by: user, action type, claim, date range.
- ADMIN can export the audit log as CSV.

### 7.4 Gherkin Acceptance Criteria

```gherkin
Feature: E6 — Administration

  Background:
    Given thomas (ADMIN) is authenticated
    And he navigates to "/admin"

  Scenario: US-6.1 — Create a new HANDLER user
    When thomas clicks "Nouvel utilisateur"
    And fills in name "Sophie Martin", email "sophie@claimflow.fr", role HANDLER
    And clicks "Créer"
    Then a new user is created with active = true
    And a temporary password is displayed exactly once
    And Sophie can log in with that password

  Scenario: US-6.1 — Change a user's role
    Given user "julie" has role HANDLER
    When thomas changes her role to MANAGER
    Then julie's next login redirects her to "/dashboard"
    And her existing JWT-based session retains the old role until expiry

  Scenario: US-6.1 — Deactivate a user
    Given user "sophie" has active = true
    When thomas deactivates sophie's account
    Then sophie's `active` field is set to false
    And sophie can no longer log in
    And her historical data (claims, comments, audit logs) is preserved

  Scenario: US-6.2 — Update auto-approval threshold
    Given the current AUTO_APPROVAL_AMOUNT is 2000
    When thomas changes it to 1500
    And saves
    Then subsequent claims with amount < 1500 and fraud < 30 are auto-approved
    And an AuditLog entry records "CONFIG_CHANGE" with old=2000, new=1500

  Scenario: US-6.3 — Export claims as CSV
    When thomas clicks "Exporter CSV"
    And selects filter "Statut: APPROVED" and date range "2026-01 to 2026-02"
    And clicks "Télécharger"
    Then a CSV file downloads with UTF-8 BOM encoding
    And column headers are in French
    And only APPROVED claims from that period are included

  Scenario: US-6.4 — View paginated audit log
    When thomas opens the "Journal d'audit" page
    Then he sees 50 entries per page ordered by most recent first
    When he filters by action "AUTO_ESCALATION"
    Then only escalation events are shown
```

### 7.5 Edge Cases

| ID | Edge Case | Expected Behavior |
|---|---|---|
| EC-6.1 | Admin creates user with duplicate email | 409 Conflict: "Un utilisateur avec cet email existe déjà" |
| EC-6.2 | Admin sets AUTO_APPROVAL_AMOUNT to 0 | Allowed; effectively disables auto-approval; warning displayed |
| EC-6.3 | Admin sets FRAUD_ESCALATION_SCORE to 100 | Allowed; effectively disables auto-escalation; warning displayed |
| EC-6.4 | CSV export with 0 matching records | Empty CSV with headers only is returned; no error |
| EC-6.5 | Admin navigates to another page during CSV generation | Download continues in background (browser handles it) |

### 7.6 Data Model Impacts

**Entity: `SystemConfig`** (new entity for E6)

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `key` | String | Unique config key (e.g., "AUTO_APPROVAL_AMOUNT") |
| `value` | String | Stored as string; parsed at runtime |
| `updatedAt` | DateTime | Auto-updated |
| `updatedBy` | String | FK → User (ADMIN who last changed it) |

---

## 8. Cross-Cutting Business Rules

### 8.1 Regulatory Deadlines (French Insurance Code)

| Step | Maximum Deadline | Legal Basis |
|---|---|---|
| Acknowledgment receipt | 48h after declaration | Code des assurances L113-5 |
| Compensation proposal | 3 months after declaration | Convention IRSA |
| Payment after agreement | 1 month after agreement | Code des assurances L122-2 |
| Rejection contest window | 2 years from event | Code des assurances L114-1 |

### 8.2 Reference Indemnization Schedule (Barème)

| Claim Type | Damage Category | Indicative Range |
|---|---|---|
| Glass breakage | Windshield | 300–800 EUR |
| Glass breakage | Side/rear window | 150–600 EUR |
| Collision | Light bodywork (scratch, dent) | 300–1,500 EUR |
| Collision | Heavy bodywork (structural) | 1,500–8,000 EUR |
| Collision / Comprehensive | Total loss | Argus value − deductible |
| Total theft | Vehicle missing | Argus value − deductible − depreciation |
| Vandalism | Light to heavy damage | 200–5,000 EUR |
| Fire | Partial to total | 2,000 EUR → Argus value |
| Natural disaster | Variable by damage | Minimum legal deductible 380 EUR |
| Minor bodily injury | All types | 1,000–5,000 EUR |

### 8.3 Definition of Ready (DoR)

A user story is ready for development when:
- [ ] Business rules are documented and validated
- [ ] Gherkin acceptance criteria are written and reviewed
- [ ] Edge cases are identified and prioritized
- [ ] Data model impacts are specified
- [ ] Dependencies on other epics are identified

### 8.4 Security Requirements (All Epics)

- All API routes require authentication via NextAuth session token.
- Role-based access control is enforced server-side on every endpoint.
- Input validation via Zod schemas on 100% of API endpoints (request and response).
- No `any` type in TypeScript; all types inferred from Prisma and Zod.
- File uploads: server-side size and MIME type validation independent of client-side.
- Audit log: all authentication events, status changes, and AI calls are logged.

---

## 9. Global Data Model Summary

```
User (id, email, password, name, role, active)
  ├── Claim (assignedToId)
  ├── Comment (authorId)
  └── AuditLog (userId)

Policyholder (id, firstName, lastName, email, phone, policyNumber,
              vehicleMake, vehicleModel, vehicleYear, vehiclePlate,
              vehicleArgusValue, insuranceType, policyStartDate)
  └── Claim (policyholderld)

Claim (id, claimNumber, status, type, incidentDate, incidentLocation,
       description, hasThirdParty, thirdPartyData, estimatedAmount,
       policyholderld, assignedToId)
  ├── Document (claimId)
  ├── AIAnalysis (claimId)
  ├── Comment (claimId)
  └── AuditLog (claimId)

Document (id, claimId, fileName, fileSize, mimeType, storagePath, uploadedAt)

AIAnalysis (id, claimId, type, input, output, model, tokensUsed, durationMs, createdAt)

Comment (id, claimId, authorId, content, createdAt)

AuditLog (id, claimId, userId, action, oldValue, newValue, createdAt)

SystemConfig (id, key, value, updatedAt, updatedBy)
```

---

*BA Specifications v1.0 — ClaimFlow AI — Mars 2026 — Agent BA Deliverable*
