# NVIDIA AI Integration Specification

## 1. Status and authority

- **Status:** Approved implementation specification; implementation has not started.
- **Target repository:** `kofiarhin/brain`
- **Audited branch and revision:** `main` at `62b52cbcd4a6ead7dbba4cecf62ca60af2afce15`
- **Product authority:** [`PRD.md`](PRD.md)
- **Current architecture reference:** [`TECHNICAL_SPEC.md`](TECHNICAL_SPEC.md)
- **Scope:** NVIDIA-hosted embeddings, chat/LLM inference, reranking, and a later compatible vision workflow.

This document defines proposed behavior. It must not be read as evidence that NVIDIA inference, vector search, reranking, vision processing, migrations, tests, or production deployment already exist.

## 2. Objective

Add a grounded AI retrieval pipeline to Brain so the authenticated user can search and reason over saved information by meaning rather than exact keywords.

The first release must:

1. embed saved notes with an NVIDIA-hosted embedding model;
2. store embeddings beside their source records in MongoDB;
3. retrieve semantically related notes with MongoDB Atlas Vector Search;
4. generate a grounded answer with an NVIDIA-hosted chat model;
5. preserve the current local read-only fallback when the hosted provider is unavailable;
6. keep chat read-only with respect to durable Brain records.

Reranking follows after the core retrieval path is verified. Vision is a separate later phase and must not block the first release.

## 3. Existing system

The current implementation has:

- an authenticated `POST /api/chat` controller in `server/controllers/chatController.js`;
- persisted `ChatConversation` and `ChatMessage` records;
- keyword/regular-expression retrieval in `server/services/brainContextBuilder.js`;
- prompt construction in `server/services/chatPrompt.js`;
- Hugging Face inference in `server/services/huggingFaceClient.js`;
- a deterministic local fallback in `server/services/localChatFallback.js`;
- a minimal `Note` model containing `content` and timestamps;
- Jest/Supertest coverage in `server/__tests__/chat.test.js`.

Current chat builds a broad context bundle, sends a text prompt to Hugging Face, and stores the response. This specification changes the provider and note-retrieval path while retaining the authenticated route, conversation persistence, explicit prompt guardrails, and local fallback.

## 4. Product boundaries

### 4.1 Required boundaries

- MongoDB remains the source of truth.
- NVIDIA receives only the minimum text or image content required for the requested inference operation.
- `NVIDIA_API_KEY` is server-only and must never use a `VITE_` prefix.
- Chat remains read-only. Model output cannot directly create, update, delete, archive, complete, or reschedule Brain records.
- Existing CRUD and Codex-command workflows remain independent of provider availability.
- The application must not claim that a response is grounded when retrieval failed or returned no usable evidence.
- Model identifiers, endpoints, embedding dimensions, timeouts, and result limits must be configurable rather than permanently hard-coded.

### 4.2 Out of scope

- autonomous agents that mutate Brain data;
- multi-user tenancy or billing;
- self-hosted NVIDIA NIM infrastructure;
- training a custom embedding model;
- replacing MongoDB with a separate vector database;
- automatically embedding every Brain domain in the first release;
- production deployment, credential creation, or provider-contract guarantees;
- OCR or vision ingestion in the core release.

## 5. Target architecture

```text
Note create/update
  -> normalize and chunk text
  -> NVIDIA embedding API
  -> store embedding metadata on Note

User question
  -> NVIDIA query embedding
  -> MongoDB Atlas Vector Search
  -> optional NVIDIA reranker
  -> best evidence plus structured Brain context
  -> NVIDIA chat model
  -> persisted read-only answer

Provider unavailable
  -> existing local context summary fallback
```

The Express backend coordinates every NVIDIA call. The React client continues to call `/api/chat` and never calls NVIDIA directly.

## 6. NVIDIA service adapter

Create `server/services/nvidiaClient.js` as the only module that knows NVIDIA request formats and authentication.

It should expose:

```js
createEmbedding({ input, inputType });
rerankDocuments({ query, documents, topN });
generateChatCompletion({ messages, maxTokens });
analyzeImage({ image, prompt }); // phase 4 only
```

The adapter must:

- attach `Authorization: Bearer ${NVIDIA_API_KEY}` server-side;
- use an `AbortController` timeout for each request;
- normalize provider responses into stable internal return shapes;
- classify provider failures with an `NvidiaProviderError` carrying a safe `code`, retryability, HTTP status when available, and operation name;
- never log authorization headers, raw keys, full private note content, or full provider response bodies;
- support dependency injection or mocked `fetch` for unit tests;
- treat empty or malformed model output as provider failure;
- retry only transient failures such as `429`, `502`, `503`, and `504`;
- honor `Retry-After` when present and otherwise use capped exponential backoff with jitter;
- avoid retrying authentication, validation, unsupported-model, or content-policy failures.

One NVIDIA-hosted API key is expected to authenticate supported hosted model calls. Model availability, rate limits, billing, and request schemas remain model/account specific and must be validated before implementation locks a model choice.

## 7. Configuration

Add server-only variables to `.env.example`:

```env
NVIDIA_API_KEY=
NVIDIA_API_BASE_URL=
NVIDIA_CHAT_MODEL=
NVIDIA_EMBEDDING_MODEL=
NVIDIA_RERANK_MODEL=
NVIDIA_VISION_MODEL=
NVIDIA_EMBEDDING_DIMENSIONS=
NVIDIA_REQUEST_TIMEOUT_MS=30000
NVIDIA_MAX_RETRIES=2
AI_QUESTION_LIMIT_PER_MINUTE=5
AI_VECTOR_CANDIDATES=20
AI_RERANKED_RESULTS=5
AI_MAX_CONTEXT_CHARS=18000
AI_MAX_ANSWER_TOKENS=700
AI_NOTE_CHUNK_CHARS=2400
AI_NOTE_CHUNK_OVERLAP_CHARS=300
```

`NVIDIA_API_BASE_URL` and all model identifiers must be selected from the account's currently supported NVIDIA-hosted API catalog during implementation. The application must fail configuration validation when an enabled operation lacks its required model or has an invalid embedding dimension.

The key belongs in the environment of the Express backend. If Vercel hosts only the frontend and Heroku hosts Express, configure it in Heroku. If a later deployment moves Express to Vercel functions, configure it in that server runtime. Never expose it through client code.

## 8. Data model

### 8.1 Core-release Note fields

Extend `server/models/Note.js` with embedding state:

```js
embedding: { type: [Number], select: false, default: undefined },
embeddingModel: { type: String, default: '' },
embeddingDimensions: { type: Number, default: null },
embeddingContentHash: { type: String, default: '' },
embeddingStatus: {
  type: String,
  enum: ['pending', 'ready', 'failed', 'stale'],
  default: 'pending',
},
embeddingUpdatedAt: { type: Date, default: null },
embeddingErrorCode: { type: String, default: '' },
```

Use a deterministic hash of normalized embeddable content to avoid regenerating unchanged embeddings. Never store provider credentials or raw provider error payloads.

### 8.2 Chunking decision

The initial `Note` schema contains one short text field. Implement single-vector-per-note retrieval first unless repository data inspection shows notes routinely exceed the configured chunk size.

If chunking is required, use a dedicated `KnowledgeChunk` collection instead of placing multiple large vectors on the parent document:

```js
{
  sourceType: 'note',
  sourceId: ObjectId,
  chunkIndex: Number,
  content: String,
  contentHash: String,
  embedding: [Number],
  embeddingModel: String,
  embeddingDimensions: Number,
  embeddingStatus: 'pending' | 'ready' | 'failed' | 'stale',
  sourceUpdatedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Chunks must be ordered, overlap only enough to preserve boundary meaning, and retain source IDs so responses can cite their evidence. Deleting a source must delete its chunks. Updating a source must replace or mark stale its old chunks atomically enough to prevent mixed versions from being treated as current.

### 8.3 Embedding compatibility

Every stored vector must record its model and dimensions. A vector index supports one configured dimension. Changing model or dimensions requires a new index and controlled re-embedding; old and new vectors must not be mixed in one similarity query.

## 9. Embedding lifecycle

### 9.1 Create and update

For a note create/update request:

1. validate and persist the note's source text using existing domain rules;
2. normalize the embeddable text and compute its hash;
3. if the hash and configured model match a `ready` embedding, skip regeneration;
4. otherwise set embedding state to `pending` or `stale`;
5. call the NVIDIA embedding model;
6. validate that the returned vector is numeric, finite, non-empty, and has the configured dimensions;
7. update the embedding, model, dimensions, hash, status, and timestamp;
8. on provider failure, retain the source note and mark embedding state `failed` with a safe error code.

A provider outage must not destroy or reject otherwise valid user-authored note data. The note remains available to CRUD and keyword/local fallback behavior until embedding succeeds.

### 9.2 Synchronous versus queued work

The first release may embed a single short note synchronously if observed latency is acceptable. Bulk imports and backfills must be bounded and queue-like: process small batches, limit concurrency, checkpoint progress, and tolerate restart. Do not send the entire database in one batch.

If synchronous embedding is used, the API response must distinguish `ready` from `saved_pending_embedding`. A failed embedding must be retryable without editing the note.

### 9.3 Backfill

Add a script such as `server/scripts/backfillNoteEmbeddings.js` with:

- dry-run mode;
- configurable batch size and concurrency;
- resume support based on status/model/hash;
- skip logic for current `ready` embeddings;
- rate-limit-aware retry;
- progress counts without logging note content;
- a non-zero exit code for unrecoverable configuration or database failures;
- a final summary of ready, skipped, failed, and remaining records.

Backfill does not delete old embeddings until the new model/index migration has been verified.

## 10. MongoDB Atlas Vector Search

Create an Atlas Vector Search index for the active vector field. The exact index definition must use `NVIDIA_EMBEDDING_DIMENSIONS` resolved during implementation.

Illustrative definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": "<configured integer>",
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "embeddingStatus"
    },
    {
      "type": "filter",
      "path": "embeddingModel"
    }
  ]
}
```

Create `server/services/vectorSearch.js` with:

```js
semanticSearchNotes({ queryEmbedding, limit, numCandidates });
```

The aggregation must:

- search only `ready` embeddings generated by the active model;
- use bounded `numCandidates` and result limits;
- return source ID, content, score, and embedding metadata but not the raw vector;
- exclude malformed, stale, failed, or wrong-dimension records;
- use deterministic score/result handling;
- treat an unavailable vector index as a recoverable retrieval failure, not a CRUD outage.

Initial defaults are 20 candidates and at most 5 records sent to chat after optional reranking. These are configuration defaults, not provider guarantees.

## 11. Semantic retrieval

Replace only the note keyword query in `brainContextBuilder.js` during the core release. Retain direct structured queries for:

- active goals;
- active projects;
- open tasks;
- the active/latest day plan;
- preferences;
- reviews, deliverables, generated posts, and update reports where current recency queries remain appropriate.

Ideas may remain keyword-based until a later approved migration.

Create `server/services/semanticRetrieval.js` to coordinate:

1. query embedding;
2. vector search;
3. optional reranking;
4. evidence normalization;
5. bounded return to `buildBrainContext`.

When semantic retrieval fails, use the existing keyword note query and mark retrieval metadata as degraded. This preserves useful chat behavior without falsely claiming semantic grounding.

Return retrieval metadata separate from content:

```js
{
  notes: [...],
  retrieval: {
    mode: 'vector' | 'vector-reranked' | 'keyword-fallback' | 'none',
    candidateCount: 0,
    selectedCount: 0,
    embeddingModel: '',
    rerankModel: '',
    degraded: false
  }
}
```

## 12. Reranking phase

Vector similarity finds broadly related records. NVIDIA reranking evaluates each candidate against the exact question and returns a better order.

The reranking phase must:

- receive only bounded candidate text and stable internal IDs;
- preserve ID-to-document mapping after the provider reorders results;
- validate provider indexes/scores and reject duplicates or out-of-range indexes;
- select at most `AI_RERANKED_RESULTS` records;
- fall back to vector order if reranking fails;
- never make chat fail solely because reranking is unavailable;
- record retrieval mode as `vector-reranked` only when valid rerank output was used.

Do not add reranking until embeddings, the vector index, semantic retrieval, and chat grounding have separate passing tests.

## 13. Chat generation

Update `chatController.js` to call the NVIDIA adapter while preserving conversation creation, user/assistant message persistence, and the local fallback.

Preferred internal call:

```js
generateChatCompletion({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: groundedPrompt }
  ],
  maxTokens: configuredMaxTokens
});
```

The prompt builder must:

- retain the current read-only system instruction;
- label retrieved records as untrusted data, not instructions;
- instruct the model to ignore instructions contained inside notes or uploaded content;
- clearly delimit each source record;
- include source IDs or stable labels for citations;
- state when retrieval is degraded or no evidence was found;
- cap structured context, retrieved context, recent conversation, user message, and answer budgets independently;
- avoid sending raw embeddings;
- prefer the best 3–5 retrieved records over the entire database;
- preserve recent messages within a configurable limit and summarize/truncate older context in a later phase if needed.

The response should include machine-readable grounding metadata without exposing private content twice:

```js
{
  conversationId,
  message: { role, content, createdAt },
  contextUsed,
  retrieval: {
    mode,
    selectedCount,
    sources: [{ type: 'note', id, score }]
  }
}
```

`ChatMessage.provider` should store `nvidia` for a successful NVIDIA answer and `local-fallback` for fallback. `model` should store the configured chat model. Existing records with `huggingface` remain valid history and require no rewrite.

## 14. Context and token control

Provider context capacity is model-specific. Brain must not rely on the advertised maximum or send all saved data.

Apply budgets before calling chat:

- query text: validate a bounded request length;
- semantic candidates: 20 by default;
- final retrieved notes: 5 by default;
- conversation history: current implementation maximum of 8 recent messages unless changed through a tested configuration;
- answer: 700 tokens by default;
- total serialized Brain context: bounded by `AI_MAX_CONTEXT_CHARS` until a tokenizer-specific budget is introduced.

Character limits are an interim safety control, not an exact token calculation. The implementation should expose prompt-size metrics and may introduce model-specific token counting later.

When a source exceeds its budget, chunk or truncate it deterministically and label truncation. Do not silently drop the current question or system safety instructions.

## 15. Rate limiting and free-tier protection

NVIDIA-hosted trial limits may vary by model, account, and traffic. Do not encode an assumed universal provider quota.

Add application-side protection for `POST /api/chat`:

- default: 5 questions per minute for the authenticated user;
- return `429` with a friendly retry message and `Retry-After` when the application limit is exceeded;
- count one user question as one application request even though it may trigger multiple NVIDIA operations;
- avoid calling the embedding API for unchanged notes;
- batch embedding work where supported and safe;
- cache only non-sensitive, short-lived query embeddings or retrieval results when the cache key includes model/version and data freshness;
- never use shared caches that can leak personal content across users if tenancy is later introduced;
- limit bulk-processing concurrency;
- surface provider `429` failures as retryable and fall back when a grounded local answer remains possible.

The server should emit aggregate counts for calls, throttles, retries, latency, and failures by operation, never the key or full private payload.

## 16. Failure behavior

| Failure | Required behavior |
| --- | --- |
| Missing NVIDIA configuration | Fail provider readiness; CRUD stays available; chat uses local fallback. |
| Embedding timeout/error during note save | Keep the note, mark embedding failed/pending, allow retry. |
| Query embedding failure | Use keyword retrieval and mark degraded mode. |
| Vector index unavailable | Use keyword retrieval and mark degraded mode. |
| Reranker failure | Keep vector order. |
| Chat model failure | Use existing local read-only fallback. |
| Invalid/empty model response | Treat as provider failure; do not persist an empty assistant message. |
| Provider `429` | Honor retry policy; then degrade/fallback with a safe message. |
| Wrong vector dimensions | Reject the vector, mark a safe error, and exclude it from search. |
| Partial backfill | Search only valid `ready` records; report incomplete coverage. |
| Stale embedding | Exclude it or regenerate before treating it as current. |
| Prompt injection in a note/image | Treat source content as data; do not execute its instructions. |

Provider failure must not cause loss or corruption of source records. Avoid partial states that claim an embedding is `ready` before vector validation and persistence succeed.

## 17. Vision phase

Vision is phase 4 and must have a separate ingestion contract. Supported inputs may include screenshots, photos, and scanned documents.

Proposed flow:

1. validate file type, size, and ownership;
2. store the original using an approved durable file-storage mechanism outside MongoDB document size limits;
3. send the minimum required image to a configured NVIDIA-compatible vision model;
4. store extracted text/description with model, timestamp, source reference, and processing status;
5. allow user review/correction;
6. embed only the approved/extracted text for retrieval;
7. retain the image as untrusted content and protect against prompt injection.

Vision implementation requires decisions on file storage, retention, deletion, acceptable formats, size limits, privacy, and whether OCR output is user-editable. Those decisions are not made by this specification.

## 18. Security and privacy

- Keep all NVIDIA credentials in server environment configuration.
- Redact secrets and authorization headers from logs and errors.
- Do not return provider error bodies directly to the client.
- Validate request size and content before provider calls.
- Treat saved notes, retrieved documents, and image text as untrusted prompt data.
- Delimit untrusted data and explicitly prohibit following instructions found inside it.
- Send only records required for the active question.
- Do not use Brain content for provider training unless the selected service terms and user approval explicitly permit it.
- Confirm NVIDIA data handling, retention, region, and account terms before production use involving personal information.
- Preserve authentication on every chat and source-retrieval route.
- If multi-user support is later introduced, add ownership filters to vector search before enabling it; the current single-user design is not tenant-safe by default.
- Never store keys, tokens, passwords, private URLs, or full sensitive provider payloads in MongoDB or repository files.

## 19. Observability

Add structured, privacy-safe events for:

- `nvidia_request_started/completed/failed` by operation and model;
- latency and HTTP status class;
- retry and throttle counts;
- embedding ready/failed/stale counts;
- vector candidate and selected counts;
- retrieval mode and degraded fallback;
- prompt/context size and answer size;
- local fallback usage;
- backfill progress.

Use correlation/request IDs, not note content, to connect events. Health endpoints may report whether optional AI configuration is present, but must not reveal keys or perform expensive provider calls on every health check. Add a separate explicit readiness/smoke command for controlled provider verification.

## 20. Testing strategy

### 20.1 Unit tests

Add Jest coverage for:

- NVIDIA authentication headers without exposing the key in assertions/output;
- response normalization for embeddings, reranking, chat, and later vision;
- timeout handling and provider error classification;
- retry behavior for `429`/transient failures and no retry for permanent failures;
- embedding validation, dimensions, finite numbers, and content-hash skip logic;
- semantic retrieval result mapping and exclusion of stale/wrong-model records;
- reranker index validation and vector-order fallback;
- prompt boundaries, source labels, read-only instruction, and context budgets;
- prompt-injection text remaining quoted/untrusted data;
- rate limiter behavior;
- local fallback behavior.

### 20.2 Controller/integration tests

Update `server/__tests__/chat.test.js` and add focused service tests to prove:

- authentication remains required;
- a successful NVIDIA answer persists `provider: 'nvidia'` and the configured model;
- context and retrieval metadata are returned;
- no chat path mutates notes, tasks, goals, projects, or plans;
- query-embedding failure uses keyword retrieval;
- vector failure uses keyword retrieval;
- reranker failure keeps vector order;
- chat-provider failure persists the local fallback result;
- rate-limit rejection does not call NVIDIA;
- malformed provider output cannot persist an empty answer.

Mock NVIDIA and MongoDB aggregation in automated tests. Do not require a live API key for the normal test suite.

### 20.3 Atlas verification

Against a non-production Atlas database:

- create the vector index with the selected dimensions;
- insert known notes and embeddings;
- prove meaning-based retrieval with vocabulary that differs from the saved note;
- prove status/model filters exclude incompatible records;
- measure candidate and result limits;
- verify index-not-ready behavior degrades safely.

### 20.4 Provider smoke tests

Use an explicit opt-in command requiring real environment configuration. Verify one small request per enabled operation, record model names/status/latency, avoid personal content, and never run automatically in CI with untrusted pull requests.

### 20.5 Regression verification

Run:

```bash
npm test
```

Also build the client and smoke-test authentication, note CRUD, chat history, local fallback, health/version, and the read-only boundary. Provider success alone does not verify the complete feature.

## 21. Migration and rollout

### Phase 0 — configuration and adapter

- add validated environment configuration;
- add `nvidiaClient.js` and unit tests;
- add privacy-safe telemetry;
- keep production chat on the existing provider until acceptance criteria pass.

### Phase 1 — embeddings and vector search

- extend the Note model;
- create the Atlas vector index;
- add embedding lifecycle and backfill script;
- add semantic note retrieval with keyword fallback;
- verify against a non-production database.

### Phase 2 — NVIDIA grounded chat

- switch chat generation to NVIDIA;
- preserve the local fallback and persisted history;
- add response grounding metadata;
- enforce context and application rate limits;
- deploy behind an environment feature flag if production rollback requires it.

### Phase 3 — reranking

- add the configured reranking model;
- verify relevance improvement with a fixed evaluation set;
- retain vector-order fallback.

### Phase 4 — vision

- approve storage, retention, file validation, and review UX;
- implement extraction and optional embedding of reviewed text;
- add deletion and privacy tests.

Each phase requires its own verified commit/revision evidence. Later phases must not be described as complete because an earlier phase was deployed.

## 22. Rollback

- Keep the current local fallback available.
- Use configuration/feature flags to disable vector retrieval, reranking, or NVIDIA chat independently.
- Disabling NVIDIA must not remove source notes or conversation history.
- Preserve old embedding fields during a model migration until the new index and backfill are verified.
- If the vector index fails, revert retrieval to keyword mode without changing CRUD behavior.
- Rollback documentation must state which revision, model, index, and environment were restored.

## 23. Affected files

Expected additions:

```text
server/services/nvidiaClient.js
server/services/vectorSearch.js
server/services/semanticRetrieval.js
server/scripts/backfillNoteEmbeddings.js
server/__tests__/nvidiaClient.test.js
server/__tests__/semanticRetrieval.test.js
```

Expected updates:

```text
.env.example
package.json
server/models/Note.js
server/models/ChatMessage.js
server/controllers/chatController.js
server/services/brainContextBuilder.js
server/services/chatPrompt.js
server/routes/notes.js or the existing note controller/service path
server/__tests__/chat.test.js
README.md
docs/TECHNICAL_SPEC.md
```

Conditional later additions include `KnowledgeChunk`, file-storage models/services, upload routes, and vision tests. Final file scope must be revalidated against the repository at implementation time.

## 24. Acceptance criteria

### Core release

- One server-side `NVIDIA_API_KEY` authenticates configured NVIDIA-hosted embedding and chat calls without reaching the client bundle or logs.
- Creating or updating a note produces a validated, versioned embedding or a clear retryable embedding state without losing the note.
- Existing notes can be backfilled safely in bounded, resumable batches.
- Atlas Vector Search retrieves meaningfully related ready notes using the active model/dimensions.
- Chat sends only bounded, relevant evidence and remains read-only.
- NVIDIA chat responses and local fallback responses are correctly attributed in persisted message metadata.
- Query embedding/vector failures degrade to keyword retrieval; chat failure degrades to the local summary.
- Application and provider throttling produce safe, retryable behavior.
- No secret, raw vector, or unnecessary private content is returned to the browser or written to logs.
- Automated tests cover success, failure, fallback, rate limit, stale embedding, dimension mismatch, and read-only behavior.
- `npm test` passes, the client builds, non-production Atlas retrieval is verified, and an opt-in NVIDIA smoke test succeeds before production enablement.

### Reranking

- Valid reranking improves ordering on an agreed fixed evaluation set.
- Invalid or unavailable reranking never prevents vector-based chat.

### Vision

- File storage, retention, validation, deletion, privacy, and user-review behavior are separately approved and tested.
- Extracted image content is labelled with source/model/status and is treated as untrusted data.

## 25. Open implementation decisions

These values must be resolved from current provider/account and deployment evidence before implementation:

- exact NVIDIA chat, embedding, reranking, and vision model identifiers;
- actual embedding dimensions and corresponding Atlas index name;
- NVIDIA base URLs and request schemas for each chosen model;
- observed free-tier limits and whether the application limit should be lower;
- synchronous versus queued note embedding after latency measurement;
- whether current note lengths require `KnowledgeChunk` in phase 1;
- authoritative Express deployment environment;
- production feature-flag and rollback mechanism;
- vision file storage, retention, and deletion policy.

Model selection must be recorded as configuration and deployment evidence, not silently converted from examples into permanent architecture.

## 26. Definition of done

This specification is complete when it exists on the approved repository branch and accurately maps the proposed integration to the audited codebase. The NVIDIA integration itself is done only when the applicable phase acceptance criteria are implemented, independently verified against exact commits and environments, documented, and deployed when separately authorized.
