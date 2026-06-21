# Creator Card Microservice API

This is the implementation of the Node.js Backend Engineer 2026 assessment. It
uses the provided Node.js project scaffold and adds a Creator Card REST API for
creating, publicly retrieving, and deleting shareable creator profile cards.

## What Was Implemented

- `POST /creator-cards` creates Creator Cards with VSL field validation and
  custom business-rule validation.
- `GET /creator-cards/:slug` publicly retrieves published cards while enforcing
  draft and private-card access rules.
- `DELETE /creator-cards/:slug` soft-deletes cards by slug after validating the
  required `creator_reference` request body.
- Cards are stored in MongoDB using `_id` internally and serialized as `id` in
  all API responses.
- Public retrieval responses omit `access_code`.
- Deleted cards are no longer publicly retrievable.
- Assessment business error codes are implemented: `SL02`, `AC01`, `AC05`,
  `NF01`, `NF02`, `AC03`, and `AC04`.
- Endpoint tests cover the required valid and invalid assessment scenarios.

## About Template Code

The assessment explicitly requires using the provided backend template and
following its structure. For that reason, unused scaffold modules were left in
place unless they interfered with the assessment implementation. Removing large
parts of the template is not required by the assessment and can increase the
risk of deviating from the expected project organization.

## Main Project Structure

```text
app.js                         # Registers the app endpoints
bootstrap.js                   # Runtime entry point
models/creator-card.js         # Creator Card MongoDB model
services/creator-cards/        # Create, get, and delete business logic
endpoints/creator-cards/       # HTTP route handlers
core/                          # Provided template core utilities
test/creator-cards.test.js     # Creator Card API tests
assessment.md                  # Original assessment instructions
DEPLOYMENT.md                  # Render/Heroku deployment guide
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB Atlas, local MongoDB, or another MongoDB-compatible instance

## Environment Variables

Create a `.env` file from `.env.example` and set at least:

```text
PORT=3000
MONGODB_URI=mongodb://localhost:27017/creator_cards_assessment
APP_NAME=creator-card-api
APP_BASE_URL=http://localhost:3000
PINO_LOG_LEVEL=info
```

For hosted deployment, use your MongoDB Atlas connection string for
`MONGODB_URI`.

Do not set `USE_SECRETS_MANAGER` unless AWS Secrets Manager is configured.

## Setup

Install dependencies:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Start the API locally:

```bash
npm start
```

The local base URL is usually:

```text
http://localhost:3000
```

## API Endpoints

### Create Creator Card

```text
POST /creator-cards
```

Example request:

```json
{
  "title": "George Cooks",
  "description": "Weekly cooking podcast",
  "slug": "george-cooks",
  "creator_reference": "crt_8f2k1m9x4p7w3q5z",
  "links": [{ "title": "YouTube", "url": "https://youtube.com/@georgecooks" }],
  "service_rates": {
    "currency": "NGN",
    "rates": [
      {
        "name": "IG Story Post",
        "description": "One story mention",
        "amount": 5000000
      }
    ]
  },
  "status": "published",
  "access_type": "public"
}
```

Success response:

```json
{
  "status": "success",
  "message": "Creator Card Created Successfully.",
  "data": {
    "id": "01JG8XYZA2B3C4D5E6F7G8H9J0",
    "title": "George Cooks",
    "slug": "george-cooks",
    "creator_reference": "crt_8f2k1m9x4p7w3q5z",
    "access_type": "public",
    "access_code": null,
    "created": 1767052800000,
    "updated": 1767052800000,
    "deleted": null
  }
}
```

If `slug` is omitted, it is generated from `title`. If the generated slug is
too short or already taken, a random six-character suffix is appended.

### Retrieve Public Creator Card

```text
GET /creator-cards/:slug
```

Private cards require an access code query parameter:

```text
GET /creator-cards/vip-rate-card?access_code=A1B2C3
```

Retrieval responses never include `access_code`.

### Delete Creator Card

```text
DELETE /creator-cards/:slug
```

Request body:

```json
{
  "creator_reference": "crt_8f2k1m9x4p7w3q5z"
}
```

Delete is a soft delete. The card remains in MongoDB with `deleted` set to a
timestamp, but `GET /creator-cards/:slug` returns `NF01` after deletion.

## Validation And Error Behavior

Field-level validation uses the template validator and returns HTTP `400`.

Custom business-rule errors:

| Code | HTTP | Meaning |
| ---- | ---- | ------- |
| `SL02` | 400 | Slug is already taken |
| `AC01` | 400 | `access_code` is required for private cards |
| `AC05` | 400 | `access_code` can only be set on private cards |
| `NF01` | 404 | Creator card not found |
| `NF02` | 404 | Creator card exists but is draft |
| `AC03` | 403 | Private card requires an access code |
| `AC04` | 403 | Invalid access code |

## Testing

Run:

```bash
npm test
```

The test suite uses the template mock HTTP server and an in-memory model stub.
It does not require a test MongoDB instance.

The tests cover:

- Full public card creation
- Slug auto-generation
- Private card creation and access
- Public retrieval without leaking `access_code`
- Deletion and deleted-card retrieval behavior
- Required custom error codes
- Field-level validation failures
- Delete request-body validation

