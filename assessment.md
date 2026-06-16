# NodejsBackendEngineer2026-Assessment

## Technical Assessment

**IMPORTANT: You must use the provided project template**
📦 [Backend Template Repository](https://github.com/the17thstudio/node-template)

**IMPORTANT: Follow the instructions to the letter**
The ability to follow instructions precisely is a core part of what this assessment evaluates. A correct, working implementation that did not follow the instructions to the letter will **NOT** be considered.

Build a **Creator Card microservice API** that lets creators publish a shareable profile card showcasing their links and service rates (think "link-in-bio" cards with rate cards attached).

> Note: This assessment is a standalone technical exercise. It is not a reflection of the products or domain you will actually work on.

### Overview

Your task is to create a REST API with three endpoints: one that creates Creator Cards after validating them against the rules below, one that publicly retrieves a card by its slug while respecting draft status and private access controls, and one that deletes a card by its slug.

### The Creator Card Entity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | string | ULID | Stored as `_id` in MongoDB, but ALWAYS serialized as `id` in API responses |
| `title` | string | 3–100 characters | e.g. "George Cooks" |
| `description` | string | max 500 characters | e.g. "George Cooks is a weekly cooking podcast by Chef George AmadiObi" |
| `slug` | string | 5–50 characters; unique; letters, numbers, hyphens and underscores only | Public identifier used for card retrieval |
| `creator_reference` | string | exactly 20 characters | Identifies the creator on the consuming service |
| `links[]` | array of objects | — | Links the creator wants to showcase |
| `links[].title` | string | 1–100 characters | Title of the link |
| `links[].url` | string | max 200 characters; must start with `http://` or `https://` | Link URL |
| `service_rates` | object | — | Rates offered by the creator for services |
| `service_rates.currency` | string | enum: `NGN` \| `USD` \| `GBP` \| `GHS` | Currency for all rates on the card |
| `service_rates.rates[]` | array of objects | non-empty if `service_rates` is present | Individual service rates |
| `service_rates.rates[].name` | string | 3–100 characters | e.g. "IG Story Post" |
| `service_rates.rates[].description` | string | max 250 characters | Description of the service |
| `service_rates.rates[].amount` | number | positive integer (min 1) | Minor units: kobo for NGN, cents for USD, pence for GBP, pesewas for GHS |
| `status` | string | enum: `draft` \| `published` | Drafts can NEVER be retrieved via the public endpoint |
| `access_type` | string | enum: `public` \| `private` | Defaults to `public` |
| `access_code` | string | exactly 6 alphanumeric characters | Required if `access_type` is `private` |
| `created` | number | — | Unix epoch milliseconds |
| `updated` | number | — | Unix epoch milliseconds |
| `deleted` | number \| null | — | `null` unless the card has been deleted |

**Important - `_id` vs `id`:** In MongoDB the document identifier lives in the `_id` field, per MongoDB convention. However, all front-facing API responses must expose it as `id`. Your serialization layer is responsible for this mapping - a response containing `_id` is incorrect.

### Endpoint 1: Create Creator Card

**Path:** `POST /creator-cards`

**Request Format:**
```json
{
  "title": "George Cooks",
  "description": "George Cooks is a weekly cooking podcast by Chef George AmadiObi",
  "slug": "george-cooks",
  "creator_reference": "crt_8f2k1m9x4p7w3q5z",
  "links": [
    {"title": "YouTube Channel", "url": "https://youtube.com/@georgecooks"},
    {"title": "Instagram", "url": "https://instagram.com/georgecooks"}
  ],
  "service_rates": {
    "currency": "NGN",
    "rates": [
      {"name": "IG Story Post", "description": "One Instagram story mention", "amount": 5000000},
      {"name": "Recipe Feature", "description": "Featured recipe segment on the podcast", "amount": 15000000}
    ]
  },
  "status": "published",
  "access_type": "public"
}
```

**Field Requirements:**

| Field | Required | Rules |
|-------|----------|-------|
| `title` | Yes | String, 3-100 characters |
| `description` | No | String, max 500 characters |
| `slug` | No | 5-50 characters; letters, numbers, hyphens (-) and underscores (_) only; must be unique across all cards |
| `creator_reference` | Yes | String of **exactly 20 characters** |
| `links` | No | Array; each entry must have a `title` (1-100 chars) and a valid `url` (max 200 chars) starting with `http://` or `https://` |
| `service_rates` | No | If present: `currency` must be one of NGN, USD, GBP, GHS; `rates` must be a non-empty array; each rate must have a `name` (3-100 chars), a `description` (max 250 chars), and an `amount` that is a **positive integer** (minor units - no decimals, no negatives, no zero) |
| `status` | Yes | Must be exactly `draft` or `published` |
| `access_type` | No | Must be `public` or `private` if present; defaults to `public` when omitted |
| `access_code` | Conditional | **Required** if `access_type` is `private`; must be **exactly 6 alphanumeric characters** (letters and numbers only). Must NOT be provided when `access_type` is `public` or omitted |

**A note on validation:** The project template ships with a validator DSL (VSL) that handles field-level validation - types, required fields, lengths, and enums - and returns its own formatted error responses. Use it. Your job is to ensure all validation failures return **HTTP 400**, and to implement the **business rules the validator cannot express** (slug uniqueness, the conditional access_code rules, retrieval access control). Those business rules carry the custom error codes defined below.

**Slug Auto-Generation:**

If `slug` is omitted, your service must auto-generate one from the title:
1. Lowercase the title
2. Replace whitespace with hyphens
3. Remove any characters that are not letters, numbers, hyphens, or underscores
4. If the result is shorter than 5 characters OR already taken by another card, append a hyphen followed by a random 6-character alphanumeric suffix (e.g., `cook-a8x2k1`)

If `slug` IS provided by the client and is already taken, return the `SL02` error - do NOT silently modify a client-provided slug.

**Response Format (Success - HTTP 200):**
```json
{
  "status": "success",
  "message": "Creator Card Created Successfully.",
  "data": {
    "id": "01JG8XYZA2B3C4D5E6F7G8H9J0",
    "title": "George Cooks",
    "description": "George Cooks is a weekly cooking podcast by Chef George AmadiObi",
    "slug": "george-cooks",
    "creator_reference": "crt_8f2k1m9x4p7w3q5z",
    "links": [
      {"title": "YouTube Channel", "url": "https://youtube.com/@georgecooks"},
      {"title": "Instagram", "url": "https://instagram.com/georgecooks"}
    ],
    "service_rates": {
      "currency": "NGN",
      "rates": [
        {"name": "IG Story Post", "description": "One Instagram story mention", "amount": 5000000},
        {"name": "Recipe Feature", "description": "Featured recipe segment on the podcast", "amount": 15000000}
      ]
    },
    "status": "published",
    "access_type": "public",
    "access_code": null,
    "created": 1767052800000,
    "updated": 1767052800000,
    "deleted": null
  }
}
```
*Note: `access_code` is returned in the creation response (the creator needs to know it), but it is NEVER returned by the public retrieval endpoint.*

**Response Format (Business Rule Error - HTTP 400):**
```json
{
  "status": "error",
  "message": "Slug is already taken",
  "code": "SL02"
}
```

### Endpoint 2: Public Card Retrieval

**Path:** `GET /creator-cards/:slug`

Retrieves a single Creator Card by its slug. This is the **public** endpoint that powers shareable card links.

**Access Rules (apply in this order):**

1. If no card with that slug exists → **HTTP 404**, error code `NF01`
2. If the card exists but its `status` is `draft` → **HTTP 404**, error code `NF02` (drafts are not publicly retrievable; the distinct code lets API callers distinguish "does not exist" from "exists but is a draft")
3. If the card is `private` and no `access_code` query parameter was supplied → **HTTP 403**, error code `AC03`
4. If the card is `private` and the supplied `access_code` does not match → **HTTP 403**, error code `AC04`
5. Otherwise → **HTTP 200** with the card data

**Private card access:** clients supply the pin as a query parameter:
```
GET /creator-cards/george-cooks?access_code=A1B2C3
```

**Response Format (Success - HTTP 200):**
```json
{
  "status": "success",
  "message": "Creator Card Retrieved Successfully.",
  "data": {
    "id": "01JG8XYZA2B3C4D5E6F7G8H9J0",
    "title": "George Cooks",
    "description": "George Cooks is a weekly cooking podcast by Chef George AmadiObi",
    "slug": "george-cooks",
    "creator_reference": "crt_8f2k1m9x4p7w3q5z",
    "links": [
      {"title": "YouTube Channel", "url": "https://youtube.com/@georgecooks"}
    ],
    "service_rates": {
      "currency": "NGN",
      "rates": [
        {"name": "IG Story Post", "description": "One Instagram story mention", "amount": 5000000}
      ]
    },
    "status": "published",
    "access_type": "public",
    "created": 1767052800000,
    "updated": 1767052800000,
    "deleted": null
  }
}
```
*Note: The `access_code` field is OMITTED entirely from retrieval responses, even for private cards accessed with the correct pin. The identifier is exposed as `id`, never `_id`.*

**Response Format (Error):**
```json
{
  "status": "error",
  "message": "Creator card not found",
  "code": "NF01"
}
```

### Endpoint 3: Delete Creator Card

**Path:** `DELETE /creator-cards/:slug`

Deletes the card tied to the given slug.

**Request Format:**
```json
{
  "creator_reference": "crt_8f2k1m9x4p7w3q5z"
}
```

**Field Requirements:**

| Field | Required | Rules |
|-------|----------|-------|
| `creator_reference` | Yes | String of **exactly 20 characters** |

**Behavior:**

- If no card with that slug exists → **HTTP 404**, error code `NF01`
- On success → **HTTP 200**, returning the **deleted card in the same response format as the creation endpoint**
- Once a card is deleted, it must no longer be retrievable via the public retrieval endpoint (`GET /creator-cards/:slug` returns **HTTP 404**, `NF01`)

**Response Format (Success - HTTP 200):**
```json
{
  "status": "success",
  "message": "Creator Card Deleted Successfully.",
  "data": {
    "id": "01JG8XYZA2B3C4D5E6F7G8H9J0",
    "title": "George Cooks",
    "description": "George Cooks is a weekly cooking podcast by Chef George AmadiObi",
    "slug": "george-cooks",
    "creator_reference": "crt_8f2k1m9x4p7w3q5z",
    "links": [
      {"title": "YouTube Channel", "url": "https://youtube.com/@georgecooks"},
      {"title": "Instagram", "url": "https://instagram.com/georgecooks"}
    ],
    "service_rates": {
      "currency": "NGN",
      "rates": [
        {"name": "IG Story Post", "description": "One Instagram story mention", "amount": 5000000},
        {"name": "Recipe Feature", "description": "Featured recipe segment on the podcast", "amount": 15000000}
      ]
    },
    "status": "published",
    "access_type": "public",
    "access_code": null,
    "created": 1767052800000,
    "updated": 1767052800000,
    "deleted": 1767139200000
  }
}
```

### Custom Error Codes

Field-level validation errors (wrong types, missing required fields, length violations, invalid enum values) are handled by the template's validator and simply need to return **HTTP 400**. The codes below are the **custom business rule errors you must implement yourself**:

| Business Rule | Error Code | HTTP Code | Example Message |
|---------------|------------|-----------|-----------------|
| Slug must be unique across all cards | `SL02` | 400 | "Slug is already taken" |
| access_code is required when access_type is private | `AC01` | 400 | "access_code is required when access_type is private" |
| access_code must not be set on public cards | `AC05` | 400 | "access_code can only be set on private cards" |
| Card with the given slug does not exist | `NF01` | 404 | "Creator card not found" |
| Card exists but is in draft status | `NF02` | 404 | "Creator card not found" |
| Access code required to view private card | `AC03` | 403 | "This card is private. An access code is required" |
| Invalid access code | `AC04` | 403 | "Invalid access code" |

**Important Notes:**
- The `message` field should contain a clear, human-readable message (never empty)
  - The messages in the table are **examples** - you may customize them to be more descriptive
- The `code` must match exactly as specified in the table above
- Retrieval access rules (NF01, NF02, AC03, AC04) must be applied **in the order listed** in the Access Rules section
- Note that `NF01` and `NF02` both return HTTP 404 with similar messages - the code is what allows an API caller to tell them apart

**Additional Checks & Business Logic:**

You are free to take liberties and include **additional checks, constraints, or business logic** beyond what is specified - so long as nothing you add **conflicts** with the instructions given here. The specified request/response shapes, error codes, and HTTP statuses must remain exactly as defined. Thoughtful additions are welcome and may come up for discussion at the interview stage.

### Requirements

1. **Use the provided Node.js project scaffold template** - [Backend Template](https://github.com/the17thstudio/node-template)
   - You must follow the backend template structure exactly (services, endpoints, messages, middleware conventions)
   - Use the template's validator (VSL) for field-level validation
   - Use the template's error utilities for throwing business rule errors
   - Do not deviate from the project organization

2. **MongoDB Required** - Cards must be persisted in MongoDB
   - Use MongoDB Atlas free tier (or similar) for your deployed instance
   - Documents use `_id` internally per MongoDB convention; API responses must expose `id`
   - Slug uniqueness must hold across all requests, including auto-generated slugs

3. **Deploy your solution** to Heroku, Render, or similar platform
   - All three endpoints must be publicly accessible
   - **No authentication required** - do NOT implement or require API keys, bearer tokens, or any auth headers
   - **No URL versioning** - endpoints must live at the root of your base URL: `POST {base_url}/creator-cards`, NOT `POST {base_url}/v1/creator-cards` or `POST {base_url}/api/creator-cards`

4. **Error Handling** - All errors must return appropriate JSON responses with proper HTTP status codes
   - All validation failures (framework or custom) must return HTTP 400
   - Malformed JSON bodies and unexpected server errors must not crash your service

5. **Code Quality** - Clean, readable, well-organized code that follows the template structure

### Testing Your Solution

**Valid Test Cases:**

Test Case 1 - Full creation:
```json
POST /creator-cards
{
  "title": "George Cooks",
  "description": "Weekly cooking podcast",
  "slug": "george-cooks",
  "creator_reference": "crt_8f2k1m9x4p7w3q5z",
  "links": [{"title": "YouTube", "url": "https://youtube.com/@georgecooks"}],
  "service_rates": {
    "currency": "NGN",
    "rates": [{"name": "IG Story Post", "description": "One story mention", "amount": 5000000}]
  },
  "status": "published"
}
```
*Expected: HTTP 200, card created with access_type defaulting to "public", response contains `id` (not `_id`)*

Test Case 2 - Slug auto-generation:
```json
POST /creator-cards
{
  "title": "Ada Designs Things",
  "creator_reference": "crt_a1b2c3d4e5f6g7h8",
  "status": "published"
}
```
*Expected: HTTP 200, slug auto-generated as "ada-designs-things"*

Test Case 3 - Private card creation:
```json
POST /creator-cards
{
  "title": "VIP Rate Card",
  "creator_reference": "crt_x9y8z7w6v5u4t3s2",
  "status": "published",
  "access_type": "private",
  "access_code": "A1B2C3"
}
```
*Expected: HTTP 200, access_code "A1B2C3" returned in creation response*

Test Case 4 - Retrieving a public published card:
```
GET /creator-cards/george-cooks
```
*Expected: HTTP 200 with card data, no access_code field, identifier exposed as `id`*

Test Case 5 - Retrieving a private card with correct pin:
```
GET /creator-cards/vip-rate-card?access_code=A1B2C3
```
*Expected: HTTP 200 with card data, no access_code field in response*

Test Case 6 - Deleting a card:
```json
DELETE /creator-cards/ada-designs-things
{
  "creator_reference": "crt_a1b2c3d4e5f6g7h8"
}
```
*Expected: HTTP 200, the deleted card returned in the same format as the creation response, with `deleted` set*

**Invalid Test Cases:**

Test Case 7 - Duplicate slug:
```json
POST /creator-cards
{
  "title": "Another George",
  "slug": "george-cooks",
  "creator_reference": "crt_m1n2b3v4c5x6z7l8",
  "status": "published"
}
```
*Expected: HTTP 400, SL02 (assuming Test Case 1 already created this slug)*

Test Case 8 - Missing access_code on private card:
```json
POST /creator-cards
{
  "title": "Secret Card",
  "creator_reference": "crt_q1w2e3r4t5y6u7i8",
  "status": "published",
  "access_type": "private"
}
```
*Expected: HTTP 400, AC01*

Test Case 9 - access_code on a public card:
```json
POST /creator-cards
{
  "title": "Public Card",
  "creator_reference": "crt_q1w2e3r4t5y6u7i8",
  "status": "published",
  "access_type": "public",
  "access_code": "A1B2C3"
}
```
*Expected: HTTP 400, AC05*

Test Case 10 - Framework validation failure:
```json
POST /creator-cards
{
  "title": "Bad Status Card",
  "creator_reference": "crt_q1w2e3r4t5y6u7i8",
  "status": "archived"
}
```
*Expected: HTTP 400 with the validator's error response ("archived" is not a valid status). We are checking the HTTP code here, not a custom error code.*

Test Case 11 - Retrieving a non-existent card:
```
GET /creator-cards/does-not-exist-123
```
*Expected: HTTP 404, NF01*

Test Case 12 - Retrieving a draft card:
```
GET /creator-cards/my-draft-card
```
*Expected: HTTP 404, NF02 (card exists but is a draft)*

Test Case 13 - Retrieving a private card without a pin:
```
GET /creator-cards/vip-rate-card
```
*Expected: HTTP 403, AC03*

Test Case 14 - Retrieving a private card with a wrong pin:
```
GET /creator-cards/vip-rate-card?access_code=WRONG1
```
*Expected: HTTP 403, AC04*

Test Case 15 - Deleting a non-existent card:
```json
DELETE /creator-cards/does-not-exist-123
{
  "creator_reference": "crt_q1w2e3r4t5y6u7i8"
}
```
*Expected: HTTP 404, NF01*

Test Case 16 - Retrieving a deleted card:
```
GET /creator-cards/ada-designs-things
```
*Expected: HTTP 404, NF01 (assuming Test Case 6 deleted this card)*

### Submission Checklist

Before submitting, ensure:
- ✅ Your GitHub repository is public and contains clean, well-documented code
- ✅ Your solution follows the provided template structure exactly (services, endpoints, messages)
- ✅ All three endpoints are deployed and publicly accessible
- ✅ Field-level validation uses the template's validator and returns HTTP 400 on failure
- ✅ All custom business rule errors return the correct code and HTTP status (SL02, AC01, AC05, NF01, NF02, AC03, AC04)
- ✅ Drafts return 404 with NF02 on the public endpoint and access codes never leak in retrieval responses
- ✅ Deleting a card returns the deleted card in the creation response format, and deleted cards return 404 (NF01) on the public endpoint
- ✅ API responses expose `id`, never `_id`
- ✅ Slug auto-generation and uniqueness work correctly
- ✅ No auth required to call your endpoints - no API keys or bearer tokens
- ✅ Your endpoints are at the root of your base URL with no versioning (`/creator-cards`, not `/v1/creator-cards`)
- ✅ You've tested with multiple valid and invalid cases
- ✅ You've re-read the instructions and followed them to the letter

---

## Application Process

**Submissions open:** June 10, 2026.

**Submissions close:** June 24, 2026.

Submit your completed assessment using this [Google form](https://docs.google.com/forms/d/e/1FAIpQLSekJeXzL45-iNidOqfRGzV2j7Pz5MoQyOC82qS0lk0gdBIHbw/viewform)

Your submission must include:
- GitHub repository link (public)
- Deployed **base URL only**, with no versioning and no endpoint paths (e.g., `https://submission.herokuapp.com`)

---
