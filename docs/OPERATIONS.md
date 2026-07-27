# Brain OS — Operational Readiness

Operating guide for the NVIDIA AI retrieval integration.

**Scope of evidence.** Everything in the "Implemented" column below is covered by
automated tests in this repository. Everything in "Not verified" has *not* been
executed against real infrastructure by this work. Do not treat this document as
proof that backups, a durable queue, a distributed limiter, an Atlas index, or a
live provider integration exist.

---

## 1. Status summary

| Capability | Status | Evidence |
| --- | --- | --- |
| NVIDIA retry/config validation | Implemented | `server/__tests__/nvidiaClient.test.js` |
| NVIDIA request always returns or throws | Implemented | `server/__tests__/nvidiaClient.test.js` |
| Login rate limiting | Implemented | `server/__tests__/rateLimit.test.js`, `security.test.js` |
| Chat rate limiting (shared-store capable) | Implemented | `server/__tests__/rateLimit.test.js` |
| Distributed rate-limit store | **Adapter boundary only** | No shared store provisioned |
| Helmet / CORS / body limits / proxy trust | Implemented | `server/__tests__/security.test.js` |
| Async note embedding | Implemented | `server/__tests__/noteEmbeddings.test.js` |
| Durable embedding queue | **Adapter boundary only** | No broker provisioned |
| Atlas fallback + dimension guards | Implemented (mocked) | `server/__tests__/vectorSearch.test.js` |
| Atlas vector index exists and returns results | **Not verified** | Requires a real cluster |
| Live NVIDIA integration | **Not verified** | Requires `npm run brain:smoke-test` |
| MongoDB backups | **Not verified** | No backup configuration in this repository |

---

## 2. Health and readiness endpoints

### `GET /api/health` — liveness

Returns `{ "status": "ok" }` whenever the process can serve HTTP. It performs no
database or provider work.

Use it for the platform restart probe. **A passing liveness check does not mean
the deployment is production-ready** — it says nothing about MongoDB, NVIDIA, or
the Atlas index.

### `GET /api/ready` — readiness

`200` with `status: "ok"` — required dependencies healthy, nothing degraded.
`200` with `status: "degraded"` — serving traffic, but something is limited.
`503` with `status: "unavailable"` — a required dependency (MongoDB) is down.

Reported components: `application`, `mongodb`, `rateLimitStore`, `embeddingQueue`,
`nvidia`, `vectorSearch`.

Known `degradedReasons`:

| Reason | Meaning | Action |
| --- | --- | --- |
| `rate_limit_store_not_distributed` | Using the per-process memory store | Provision a shared store before scaling past one instance |
| `rate_limit_store_fallback` | A configured shared store failed to initialise | Check the broker; limits are currently per-process |
| `embedding_queue_not_durable` | Using the in-process queue | Run the backfill after restarts |
| `nvidia_not_configured` | Integration enabled but no API key | Set `NVIDIA_API_KEY`, or set `NVIDIA_AI_ENABLED=false` |

The endpoint never returns credentials, connection strings, or provider error
bodies, and never makes a provider call. `vectorSearch.verified` is always
`false`: index existence is deliberately not probed per request.

---

## 3. Known limitations

### 3.1 Rate-limit store is per-process

The default `memory` store cannot enforce a limit across multiple Heroku dynos or
application instances, and it resets on every restart.

- **Single dyno:** login and chat limits are enforced correctly.
- **Scaled out:** effective limit is `configured_limit × instance_count`, and a
  restart clears all counters.

The store interface (`server/services/rateLimit/store.js`) accepts a shared
implementation via `registerRateLimitStoreAdapter(name, factory)`; set
`AUTH_RATE_LIMIT_STORE` / `CHAT_RATE_LIMIT_STORE` to that name. **No shared store
is provisioned and no Redis dependency has been added** — selecting and paying for
that infrastructure is an open decision.

Failure policy: if a configured shared store cannot initialise, the process falls
back to the memory store and logs `rate_limit_store_unavailable` rather than
refusing all traffic. If the store fails *during* a request, the request is
allowed and `rate_limit_store_error` is logged — an infrastructure fault must not
lock every user out.

### 3.2 Embedding queue is not durable

The in-process queue loses queued work on restart, crash, or dyno cycling, and
does not distribute work across instances.

It is safe because **notes are persisted before any job is enqueued**. A lost job
means a note stays `pending`/`stale`, never that data is lost. Recovery is the
backfill command (§5).

`registerQueueAdapter()` in `server/services/queue/queue.js` accepts a durable
backend. Recommended options, none provisioned here: BullMQ (Redis), Agenda
(MongoDB — reuses the existing database), or a hosted queue.

### 3.3 Single-user tenancy

Brain authenticates one configured `AUTH_USERNAME`, and `Note` has no owner
field. Retrieval is therefore not tenant-isolated by data; it is isolated by
authentication.

Both retrieval paths accept an `ownerFilter` that is applied to the Atlas
`$vectorSearch` filter and the keyword query, and both are tested. It is empty
today. **Before introducing multi-user support, an owner field, a migration, and a
populated `ownerFilter` are all required** — adding users without them would let
one user retrieve another's notes.

### 3.4 CORS preview patterns

`brain-*.vercel.app` and `brain-*-kofi-arhins-projects.vercel.app` are accepted by
default for backwards compatibility. Those hostnames are not exclusively
controlled by this project. Set `CORS_STRICT_ORIGINS=true` with an explicit
`CORS_ALLOWED_ORIGINS` list in production.

### 3.5 Access tokens

Tokens are stateless HS256 JWTs with no revocation list. Reducing
`JWT_EXPIRES_IN` shortens the exposure window but there is no way to invalidate an
issued token early other than rotating `JWT_SECRET` (which invalidates all
tokens). Refresh tokens and server-side session revocation are recorded as future
recommendations; they were deliberately out of scope.

---

## 4. MongoDB backup and restoration

**Not configured or verified by this work.** No backup automation exists in this
repository.

Before declaring production readiness:

1. Enable Atlas continuous backup or scheduled snapshots on the cluster.
2. Record the retention window and RPO/RTO.
3. Perform one **restore rehearsal** into a scratch database and confirm note
   counts and `embeddingStatus` distribution survive.
4. Confirm the restore procedure is documented with the exact cluster and
   snapshot identifiers used.

An untested backup is not a backup.

---

## 5. Embedding backfill and recovery

The backfill command reconstructs any embedding work the in-process queue lost.

```bash
# See how much work is outstanding without changing anything
npm run brain:backfill-embeddings -- --dry-run

# Process everything not `ready`
npm run brain:backfill-embeddings

# Only previously failed notes
npm run brain:backfill-embeddings -- --status=failed

# Bound a run
npm run brain:backfill-embeddings -- --limit=100

# After changing NVIDIA_EMBEDDING_MODEL: also re-embed notes built by the old model
npm run brain:backfill-embeddings -- --model-change
```

Behaviour: batches bounded by `AI_BACKFILL_BATCH_SIZE`, `_id`-cursor pagination
(resumable), skips already-current embeddings, prints counts but never note
content, exits non-zero if any note failed.

**Run it after every restart** until a durable queue is provisioned.

### Recovering pending / failed embeddings

```bash
# Triage
npm run brain:backfill-embeddings -- --dry-run
```

Then per status:

- `pending` / `stale` — queued work that never ran. Re-run the backfill.
- `processing` — a worker was interrupted mid-flight. Safe to re-run; jobs are
  idempotent and stale results are rejected.
- `failed` — check `embeddingErrorCode` on the note:
  - `NVIDIA_NOT_CONFIGURED` — set `NVIDIA_API_KEY`.
  - `NVIDIA_EMBEDDING_DIMENSION_MISMATCH` — model and
    `NVIDIA_EMBEDDING_DIMENSIONS` disagree (see §6).
  - `NVIDIA_RATE_LIMITED` / `NVIDIA_TIMEOUT` — transient; re-run later, and lower
    `AI_BACKFILL_BATCH_SIZE` if it recurs.
  - `NVIDIA_HTTP_ERROR` — permanent provider rejection; check model availability
    on the account.

A single note can also be retried through `POST /api/notes/:id/retry-embedding`.

---

## 6. Atlas Vector Search

### Index creation

Create a vector index on the `notes` collection named by `NVIDIA_VECTOR_INDEX`
(default `note_embedding_vector_index`):

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 2048, "similarity": "cosine" },
    { "type": "filter", "path": "embeddingStatus" },
    { "type": "filter", "path": "embeddingModel" }
  ]
}
```

### The dimension contract

Three values must agree, or retrieval silently returns nothing useful:

1. what `NVIDIA_EMBEDDING_MODEL` actually returns,
2. `NVIDIA_EMBEDDING_DIMENSIONS`,
3. `numDimensions` in the Atlas index.

Guards: the NVIDIA client rejects a vector whose length differs from
configuration (`NVIDIA_EMBEDDING_DIMENSION_MISMATCH`); vector search rejects a
mismatched query embedding and re-filters returned rows by both dimensions and
model. A wrong-dimension vector is never stored as `ready`.

### Changing the embedding model or dimensions

Old and new vectors must never be mixed in one similarity query.

1. Create a **new** index with the new dimensions (keep the old one).
2. Update `NVIDIA_EMBEDDING_MODEL`, `NVIDIA_EMBEDDING_DIMENSIONS`,
   `NVIDIA_VECTOR_INDEX`.
3. `npm run brain:backfill-embeddings -- --model-change`.
4. Verify retrieval, then remove the old index.

The `embeddingModel` filter means partially-migrated data degrades to fewer
results, not wrong results.

### Index recreation after loss

Recreate with the definition above, confirm the build completed (Atlas reports
index status), then run the backfill. Until the index is ready, retrieval
degrades to keyword mode automatically.

---

## 7. Outage behaviour

| Failure | Behaviour | Operator action |
| --- | --- | --- |
| NVIDIA unreachable / timing out | Chat returns the local read-only summary (`provider: local-fallback`). Note writes still succeed; embeddings go `failed` and are retryable. CRUD unaffected. | Check provider status; run the backfill when restored |
| NVIDIA returns 429 | Retried with `Retry-After`/jittered backoff, then degrades | Lower `CHAT_RATE_LIMIT_MAX_REQUESTS` / `AI_BACKFILL_BATCH_SIZE` |
| NVIDIA misconfigured | `/api/ready` reports `nvidia_not_configured`; chat uses local fallback | Set `NVIDIA_API_KEY` |
| Atlas vector index missing | Retrieval falls back to keyword, marked `degraded: true` with reason `VECTOR_INDEX_MISSING`. Never reported as vector grounding. | Recreate the index (§6) |
| Atlas query failure | Keyword fallback, `degraded: true` | Check cluster health |
| MongoDB down | `/api/ready` returns 503; `/api/health` still 200 | Restore the database; this is the only hard dependency |
| Rate-limit store down | Requests allowed; `rate_limit_store_error` logged | Restore the store; limits are unenforced meanwhile |
| Queue full | Enqueue returns `rejected`; the note is still saved | Run the backfill; raise `EMBEDDING_QUEUE_MAX_QUEUED` |
| Reranker fails | Vector order retained, mode stays `vector` | None; cosmetic |

Provider failure never destroys or corrupts source records.

---

## 8. Log inspection

Logs are single-line JSON. Fields: `timestamp`, `level`, `event`, `component`,
plus safe structured fields. A correlation id is issued per request and echoed as
the `X-Request-Id` response header.

Key events:

| Event | Meaning |
| --- | --- |
| `nvidia_request_completed` / `_failed` / `_retry` | Provider calls with operation, status class, retries, duration |
| `nvidia_embedding_dimension_mismatch` | Model/config disagreement |
| `embedding_enqueued`, `embedding_job_completed` / `_failed` | Embedding lifecycle transitions |
| `embedding_result_discarded` | A stale result was correctly rejected |
| `vector_search_completed` / `_failed` | Retrieval counts and typed failure codes |
| `retrieval_keyword_fallback` | Degraded retrieval, with reason |
| `rate_limit_rejected` | A throttle decision (bucket counts only) |
| `rate_limit_store_unavailable`, `queue_unavailable` | Infrastructure degradation |
| `auth_login_rejected` / `_succeeded` | Authentication outcomes |

**Never logged:** passwords, JWTs, NVIDIA keys, MongoDB connection strings,
authorization headers, note content, prompts, model responses, raw provider
bodies. Two independent defences enforce this — a field-name denylist and a
value scrubber for secret-shaped strings (`server/services/observability/logger.js`).

Set `LOG_LEVEL=debug` for verbose diagnosis; it does not lower redaction.

---

## 9. Deployment verification

After deploying, before declaring success:

```bash
curl -s https://<host>/api/health     # {"status":"ok"}
curl -s https://<host>/api/version    # name, version, environment
curl -s https://<host>/api/ready      # inspect status + degradedReasons
```

Then confirm manually:

1. Login succeeds; a wrong password returns 401.
2. Repeated wrong passwords eventually return 429 with `Retry-After`.
3. Creating a note returns promptly and the note is listed.
4. The note reaches `embeddingStatus: "ready"` shortly afterwards.
5. Chat returns an answer, and `retrieval.mode` is `vector` or `vector-reranked`
   (not `keyword-fallback`) if vector search is expected to work.
6. Security headers present, `X-Powered-By` absent:
   `curl -sI https://<host>/api/health`.

---

## 10. Live smoke test

The only command that verifies the real provider and a real Atlas index:

```bash
RUN_NVIDIA_SMOKE_TEST=true \
SMOKE_TEST_MONGODB_URI="mongodb+srv://<user>:<pass>@<non-production-cluster>/brain_smoke" \
npm run brain:smoke-test
```

Stages: NVIDIA embedding → Atlas vector retrieval (queried with different
vocabulary than the stored text, proving semantic matching) → NVIDIA rerank →
grounded chat. It creates one uniquely tagged temporary note and deletes it.

Guards: refuses without the exact opt-in flag; refuses when `NODE_ENV=production`;
requires `SMOKE_TEST_MONGODB_URI` distinct from `MONGODB_URI`; prints no keys,
connection strings, or note content; exits non-zero on failure.

It never runs in CI — `npm test` is fully mocked and offline.

---

## 11. Rollback

Configuration-level rollback, no redeploy required:

```bash
NVIDIA_RERANK_ENABLED=false        # disable reranking only
NVIDIA_VECTOR_SEARCH_ENABLED=false # fall back to keyword retrieval
NVIDIA_AI_ENABLED=false            # disable NVIDIA entirely; chat uses local fallback
```

None of these delete notes, embeddings, or conversation history.

Code-level rollback: redeploy the previous revision. The Note schema changes are
additive (`processing` status value, `embeddingQueuedAt`, `embeddingAttempts`), so
an older build tolerates the newer documents — except that an older build does not
recognise `embeddingStatus: "processing"`. Before rolling back past this change,
settle those notes:

```bash
npm run brain:backfill-embeddings
```

Record in any rollback note: the revision restored, the embedding model, the
index name, and the environment.

---

## 12. Evidence required before declaring AI retrieval production-ready

All of the following must be true, with evidence recorded against exact commits
and environments. **None of items 4–9 has been satisfied by this work.**

1. `npm test` passes (server + client).
2. The client production build passes.
3. `/api/ready` reports `ok`, or every `degradedReason` is understood and accepted.
4. The Atlas vector index exists with matching dimensions and has finished building.
5. `npm run brain:smoke-test` passes against a non-production cluster, with the
   recorded model names and latencies.
6. A backfill run reports zero remaining non-`ready` notes.
7. A MongoDB backup exists **and a restore has been rehearsed**.
8. A shared rate-limit store is provisioned, or the deployment is confirmed to run
   on exactly one instance.
9. A durable queue is provisioned, or the backfill command is scheduled to run
   after restarts.
10. Log output has been inspected and confirmed free of secrets and note content.

Provider success alone does not verify the feature.
