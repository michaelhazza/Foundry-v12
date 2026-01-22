# Agent GPT Improvement Brief

**Generated:** 2026-01-22
**Source:** Code Review Audit of Foundry-v12
**Purpose:** Document patterns, rules, and guardrails to add to each Agent GPT to prevent recurring issues

---

## Executive Summary

The audit of Foundry-v12 identified **27 distinct issues** that could have been prevented if the upstream Agent GPTs had specific rules in place. This brief provides **actionable improvements** for each agent.

| Agent | Critical | High | Medium | Low | Total |
|-------|----------|------|--------|-----|-------|
| Agent 4 (API Contract) | 2 | 1 | 0 | 0 | 3 |
| Agent 6 (Implementation Plan) | 2 | 4 | 6 | 4 | 16 |
| Agent 5 (UI Specification) | 1 | 0 | 1 | 0 | 2 |
| Agent 7 (QA/Deployment) | 0 | 1 | 3 | 0 | 4 |
| Agent 2 (Architecture) | 0 | 1 | 1 | 0 | 2 |

---

## Agent 4: API Contract GPT Improvements

### CRIT-API-001: Missing Auth Refresh Endpoint

**Issue Found:** No `POST /api/auth/refresh` endpoint defined or implemented.

**Impact:** Users with expired tokens (24h) must re-login completely. No graceful session extension.

**Add to Agent 4 GPT:**

```markdown
## MANDATORY AUTH ENDPOINTS

The following auth endpoints MUST be included in every API Contract:

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 1 | /api/auth/register | POST | New user registration |
| 2 | /api/auth/login | POST | User authentication |
| 3 | /api/auth/refresh | POST | **MANDATORY** Token refresh |
| 4 | /api/auth/logout | POST | Invalidate session |
| 5 | /api/auth/me | GET | Current user profile |
| 6 | /api/auth/profile | PATCH | Update profile |
| 7 | /api/auth/forgot-password | POST | Request password reset |
| 8 | /api/auth/reset-password/:token | GET | Validate reset token |
| 9 | /api/auth/reset-password | POST | Complete password reset |

**CRITICAL: Token refresh (POST /api/auth/refresh) is MANDATORY.**

Refresh endpoint specification:
- Request: `{ refreshToken: string }`
- Response: `{ accessToken: string, refreshToken: string, expiresIn: number }`
- Must validate refresh token from database/cache
- Must issue new access token with shorter expiry
- Must rotate refresh token (one-time use)
```

**Verification:** Check API Contract contains all 9 auth endpoints before approval.

---

### CRIT-API-002: Frontend-Backend Endpoint Mismatch

**Issue Found:**
- Frontend calls: `POST /api/projects/:projectId/sources/upload`
- Backend implements: `POST /api/sources/:sourceId/upload`

**Impact:** File upload completely broken - wrong URL.

**Add to Agent 4 GPT:**

```markdown
## ENDPOINT PATH CONSISTENCY RULES

### File Upload Endpoints

File uploads MUST follow this pattern:

1. **Create resource first:** `POST /api/{parent}/:parentId/{resources}` → returns `{ id }`
2. **Upload to resource:** `POST /api/{resources}/:resourceId/upload` → attaches file

**NEVER define upload endpoints nested under parent without resource ID:**

❌ WRONG: `POST /api/projects/:projectId/sources/upload`
✓ CORRECT: `POST /api/sources/:sourceId/upload`

**Rationale:** Upload needs existing resource ID for:
- File association
- Progress tracking
- Partial upload resume
- Validation of resource ownership

### Cross-Reference Validation

For each endpoint in API Contract, document:
1. **Frontend caller:** Which page/component calls this endpoint
2. **URL pattern:** Exact URL frontend will construct
3. **Backend route:** Exact route backend will implement

Example:
| Endpoint | Frontend Caller | Frontend URL | Backend Route |
|----------|-----------------|--------------|---------------|
| Upload source file | SourceUploadPage | `/api/sources/${sourceId}/upload` | `POST /sources/:sourceId/upload` |

**MANDATE:** API Contract must include "Frontend Integration" section mapping each endpoint.
```

---

### HIGH-API-003: Missing Export Format Validation

**Issue Found:** Dataset export `format` query param accepts any string without validation.

**Add to Agent 4 GPT:**

```markdown
## QUERY PARAMETER VALIDATION

All query parameters with constrained values MUST specify:
1. **Allowed values** (enum)
2. **Default value**
3. **Validation error response**

Example for export format:

| Parameter | Type | Required | Values | Default |
|-----------|------|----------|--------|---------|
| format | string | No | `json`, `csv`, `jsonl` | `jsonl` |

**Response if invalid:**
```json
{
  "error": {
    "code": "INVALID_FORMAT",
    "message": "Format must be one of: json, csv, jsonl"
  }
}
```
```

---

## Agent 6: Implementation Plan GPT Improvements

### CRIT-IMPL-001: Hardcoded JWT Secret Fallback

**Issue Found:** `server/lib/tokens.ts:3`
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
```

**Impact:** Production deployment without JWT_SECRET env var uses weak default secret - severe security vulnerability.

**Add to Agent 6 GPT:**

```markdown
## SECURITY-CRITICAL ENVIRONMENT VARIABLES

### Fail-Fast Pattern for Security Variables

Security-critical variables MUST throw at startup if missing:

```typescript
// ✗ WRONG - Dangerous fallback
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// ✓ CORRECT - Fail fast
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
```

### Security Variables That MUST Fail-Fast

| Variable | Minimum Length | Required In |
|----------|---------------|-------------|
| JWT_SECRET | 32 chars | All environments |
| ENCRYPTION_KEY | 64 chars (hex) | If encryption used |
| DATABASE_URL | N/A | All environments |

**NEVER provide default values for these variables.**
```

---

### CRIT-IMPL-002: N+1 Query Pattern

**Issue Found:** `server/services/project.service.ts:30-48`
```typescript
const projectsWithCounts = await Promise.all(
  projectList.map(async (project) => {
    const [sourceCount] = await db.select...  // N queries
    const [datasetCount] = await db.select... // N more queries
  })
);
```

**Impact:** List of 100 projects = 201 database queries. Severe performance degradation.

**Add to Agent 6 GPT:**

```markdown
## DATABASE QUERY PATTERNS

### BANNED: Promise.all with Database Queries

**NEVER use Promise.all with database queries inside map():**

```typescript
// ❌ CRITICAL - N+1 Query Pattern (BANNED)
const itemsWithCounts = await Promise.all(
  items.map(async (item) => {
    const count = await db.select().from(related).where(...);
    return { ...item, count };
  })
);

// ✓ CORRECT - Single query with SQL subquery
const itemsWithCounts = await db
  .select({
    ...items,
    relatedCount: sql<number>`(
      SELECT COUNT(*) FROM related
      WHERE related.item_id = ${items.id}
    )`,
  })
  .from(items);

// ✓ CORRECT - Single query with JOIN and GROUP BY
const itemsWithCounts = await db
  .select({
    id: items.id,
    name: items.name,
    relatedCount: count(related.id),
  })
  .from(items)
  .leftJoin(related, eq(related.itemId, items.id))
  .groupBy(items.id);
```

### Detection Pattern

Search for this anti-pattern:
```bash
grep -A 10 "Promise.all" server/**/*.ts | grep "await db"
```

If found, **REJECT** implementation.
```

---

### HIGH-IMPL-003: Race Condition in Role Update

**Issue Found:** `server/services/organisation.service.ts:124-145`

Multiple queries without transaction allow race condition when demoting last admin.

**Add to Agent 6 GPT:**

```markdown
## TRANSACTION REQUIREMENTS

### Operations Requiring Transactions

The following operations MUST be wrapped in `db.transaction()`:

1. **Check-then-act patterns:**
   - Check admin count → update role
   - Check balance → deduct amount
   - Check availability → reserve resource

2. **Multi-table modifications:**
   - Create parent + child records
   - Update record + insert audit log
   - Delete cascade

### Race Condition Example

```typescript
// ❌ WRONG - Race condition
const [adminCount] = await db.select({ count }).from(users)...
// Another request demotes an admin HERE
if (adminCount.count > 1) {
  await db.update(users).set({ role: 'member' })...
}

// ✓ CORRECT - Transaction with row locking
await db.transaction(async (tx) => {
  const [adminCount] = await tx
    .select({ count: count() })
    .from(users)
    .where(and(
      eq(users.organizationId, orgId),
      eq(users.role, 'admin')
    ))
    .for('update'); // Row-level lock

  if (adminCount.count <= 1) {
    throw new BadRequestError('Cannot demote last admin');
  }

  await tx.update(users).set({ role: 'member' }).where(eq(users.id, userId));
});
```

### Checklist Before Implementing Service Functions

- [ ] Does this function read then write based on the read? → **Use transaction**
- [ ] Does this function modify multiple tables? → **Use transaction**
- [ ] Does this function enforce a constraint (e.g., "last admin")? → **Use transaction + row lock**
```

---

### HIGH-IMPL-004: Unbounded Query Without LIMIT

**Issue Found:** `server/services/organisation.service.ts:131`
```typescript
const admins = await db.query.users.findMany({
  where: eq(users.organizationId, organisationId),
});
```

**Impact:** Organization with 10,000 users loads ALL into memory.

**Add to Agent 6 GPT:**

```markdown
## QUERY SAFETY RULES

### MANDATORY: All findMany/select MUST have LIMIT

```typescript
// ❌ WRONG - Unbounded query
const users = await db.query.users.findMany({
  where: eq(users.organizationId, orgId),
});

// ✓ CORRECT - Always limit
const users = await db.query.users.findMany({
  where: eq(users.organizationId, orgId),
  limit: 1000, // Explicit limit
});

// ✓ BETTER - Use count() when only counting
const [result] = await db
  .select({ count: count() })
  .from(users)
  .where(and(
    eq(users.organizationId, orgId),
    eq(users.role, 'admin')
  ));
```

### When to Use Each Pattern

| Need | Pattern |
|------|---------|
| Count items | `select({ count: count() })` |
| Check existence | `findFirst()` with `limit: 1` |
| List for user | Paginated with `limit` + `offset` |
| Process all | Batch with cursor pagination |
```

---

### HIGH-IMPL-005: Math.random() in Server Code

**Issue Found:** `server/routes/sources.routes.ts:31`
```typescript
const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
```

**Add to Agent 6 GPT:**

```markdown
## BANNED: Math.random() in Server Code

**Math.random() is BANNED in all server-side code.**

### Replacement Patterns

```typescript
import { randomBytes, randomUUID } from 'crypto';

// For unique identifiers
const id = randomUUID();

// For tokens/secrets
const token = randomBytes(32).toString('hex');

// For file naming
const suffix = `${Date.now()}-${randomBytes(8).toString('hex')}`;
```

### Detection

```bash
grep -rn "Math\.random()" server/
```

**If found, REJECT implementation.**

### Exception

`Math.random()` is acceptable ONLY in:
- Client-side UI animations
- Non-security-critical randomization (shuffle display order)
```

---

### HIGH-IMPL-006: Fire-and-Forget Async Without Error Handling

**Issue Found:** `server/services/processing.service.ts:173-175`
```typescript
setTimeout(() => {
  processRunAsync(run.id); // Promise not awaited, errors silently swallowed
}, 100);
```

**Add to Agent 6 GPT:**

```markdown
## ASYNC ERROR HANDLING

### Background Task Pattern

When spawning background tasks, MUST handle errors:

```typescript
// ❌ WRONG - Silent failure
setTimeout(() => {
  processRunAsync(run.id);
}, 100);

// ✓ CORRECT - Error logging
setTimeout(() => {
  processRunAsync(run.id).catch((error) => {
    console.error(`[BG_TASK] processRunAsync(${run.id}) failed:`, error);
    // Update status to failed
    db.update(processingRuns)
      .set({ status: 'failed', error: error.message })
      .where(eq(processingRuns.id, run.id))
      .catch(console.error); // Log nested error too
  });
}, 100);

// ✓ BETTER - Use job queue
await jobQueue.enqueue('processRun', { runId: run.id });
```

### Rule

Every async function call MUST either:
1. Be awaited in try/catch, OR
2. Have `.catch()` handler attached, OR
3. Be passed to error-handling job queue
```

---

### MED-IMPL-007: Overly Permissive Zod Schema

**Issue Found:** `server/routes/processing.routes.ts:45-50`
```typescript
config: z.record(z.unknown()).optional(),
filters: z.record(z.unknown()).optional(),
```

**Add to Agent 6 GPT:**

```markdown
## ZOD VALIDATION RULES

### BANNED: z.unknown() and z.any()

**Never use `z.unknown()` or `z.any()` in API validation:**

```typescript
// ❌ WRONG - Accepts anything
const schema = z.object({
  config: z.record(z.unknown()),
});

// ✓ CORRECT - Explicit structure
const stageConfigSchema = z.object({
  name: z.enum(['ingest', 'normalize', 'deidentify', 'filter', 'export']),
  enabled: z.boolean(),
  options: z.object({
    // Specific options per stage
  }).optional(),
});

const schema = z.object({
  stages: z.array(stageConfigSchema),
});
```

### When Structure is Dynamic

If structure genuinely varies, use discriminated unions:

```typescript
const configSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('simple'), value: z.string() }),
  z.object({ type: z.literal('complex'), items: z.array(z.string()) }),
]);
```
```

---

### MED-IMPL-008: Missing Request ID Middleware

**Issue Found:** No request tracking for debugging distributed systems.

**Add to Agent 6 GPT:**

```markdown
## STANDARD MIDDLEWARE STACK

Every Express server MUST include these middleware in order:

```typescript
// 1. Request ID (FIRST - before any logging)
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// 2. Request logging
app.use((req, res, next) => {
  console.log(`[${req.id}] ${req.method} ${req.path}`);
  next();
});

// 3. Security (helmet)
app.use(helmet());

// 4. CORS
app.use(cors({...}));

// 5. Body parsing
app.use(express.json());

// 6. Rate limiting
app.use('/api', generalLimiter);

// 7. Routes
app.use('/api', routes);

// 8. Error handler (LAST)
app.use(errorHandler);
```
```

---

### MED-IMPL-009: Hardcoded Magic Numbers

**Issues Found:**
- Password reset expiry: `60 * 60 * 1000` (1 hour)
- Invitation expiry: `7 * 24 * 60 * 60 * 1000` (7 days)
- Preview limits: `slice(0, 100)`
- Pagination max: `Math.min(100, ...)`

**Add to Agent 6 GPT:**

```markdown
## CONFIGURATION CONSTANTS

### All Magic Numbers Must Be in Config

```typescript
// ❌ WRONG - Hardcoded
const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

// ✓ CORRECT - Configurable
// config.ts
export const config = {
  auth: {
    passwordResetExpiryMs: 60 * 60 * 1000,      // 1 hour
    invitationExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    jwtExpiryMs: 24 * 60 * 60 * 1000,            // 24 hours
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  preview: {
    maxRecords: 100,
  },
};

// usage
const expiresAt = new Date(Date.now() + config.auth.passwordResetExpiryMs);
```

### Numbers That MUST Be Configurable

| Category | Values |
|----------|--------|
| Auth | Token expiry, reset expiry, invite expiry |
| Pagination | Default limit, max limit |
| Rate limiting | Window, max requests |
| File upload | Max size, allowed types |
| Preview | Max records |
```

---

### MED-IMPL-010: Type Casting Without Validation

**Issue Found:** `server/services/deidentification.service.ts:135-137`
```typescript
const enabledTypes = config.enabledTypes as PIIType[];
```

**Add to Agent 6 GPT:**

```markdown
## TYPE SAFETY RULES

### BANNED: Type Casting Database Results

**Never cast database JSONB results without validation:**

```typescript
// ❌ WRONG - Crash if data corrupted
const types = config.enabledTypes as PIIType[];

// ✓ CORRECT - Runtime validation
import { z } from 'zod';

const piiTypeSchema = z.enum(['email', 'phone', 'name', 'address']);
const enabledTypesSchema = z.array(piiTypeSchema);

const types = enabledTypesSchema.parse(config.enabledTypes);
```

### Where This Applies

- All JSONB columns from database
- All data from external APIs
- All parsed JSON from files
- All values from localStorage/cookies
```

---

### LOW-IMPL-011: Health Check Missing Fields

**Issue Found:** Health check returns only `{ status, timestamp }`, missing `version` and `checks.database`.

**Add to Agent 6 GPT:**

```markdown
## HEALTH CHECK STANDARD

Every health endpoint MUST return:

```typescript
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: 'connected' | 'disconnected';
    [key: string]: string; // Other dependencies
  };
}
```

Implementation:

```typescript
router.get('/health', asyncHandler(async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await db.execute(sql`SELECT 1`);
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  return sendSuccess(res, {
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    uptime: process.uptime(),
    checks: { database: dbStatus },
  });
}));
```
```

---

## Agent 5: UI Specification GPT Improvements

### CRIT-UI-001: Upload Flow Architecture Mismatch

**Issue Found:** UI assumes single-step upload, but API requires two-step (create source, then upload file).

**Add to Agent 5 GPT:**

```markdown
## FILE UPLOAD FLOW SPECIFICATION

### Two-Step Upload Pattern

All file upload flows MUST be specified as two-step:

**Step 1: Create Resource**
- User provides metadata (name, description)
- API call: `POST /api/{resources}` → returns `{ id }`
- UI shows progress indicator

**Step 2: Upload File**
- User selects file
- API call: `POST /api/{resources}/:id/upload` with FormData
- UI shows upload progress
- On success: navigate to detail page

### UI Specification Template

```markdown
## SourceUploadPage

### Flow
1. User enters source name
2. User selects file (drag/drop or browse)
3. On submit:
   a. Call `POST /api/projects/:projectId/sources` with `{ name, type: 'file' }`
   b. Receive `{ data: { id: sourceId } }`
   c. Call `POST /api/sources/:sourceId/upload` with FormData
   d. Navigate to `/projects/:projectId/sources/:sourceId`

### Error States
- Source creation fails: Show error, stay on page
- Upload fails: Show error, offer retry (source already created)
```
```

---

### MED-UI-002: Direct fetch() Instead of API Client

**Issue Found:** `upload.tsx:101-106` uses raw `fetch()` instead of API client.

**Add to Agent 5 GPT:**

```markdown
## API CLIENT USAGE

### All API Calls Must Use api Client

```typescript
// ❌ WRONG - Direct fetch
const response = await fetch('/api/...', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ✓ CORRECT - API client
import { api } from '@/lib/api';
const response = await api.post('/...', data);

// For file uploads
const response = await api.upload('/sources/:id/upload', formData);
```

### API Client Requirements

The api client must provide:
- `api.get<T>(url)` - GET requests
- `api.post<T>(url, data)` - POST with JSON
- `api.patch<T>(url, data)` - PATCH with JSON
- `api.delete(url)` - DELETE
- `api.upload<T>(url, formData)` - POST with FormData

All methods must:
1. Auto-attach auth token
2. Handle 401 → redirect to login
3. Parse error responses consistently
4. Support request cancellation
```

---

## Agent 7: QA/Deployment GPT Improvements

### HIGH-QA-001: Package.json Script Flags

**Issue Found:**
- `db:generate` missing `--force`
- `db:migrate` missing `--force`
- `db:studio` has unnecessary `--force`

**Add to Agent 7 GPT:**

```markdown
## DRIZZLE SCRIPT STANDARDS

### Required package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate --force",
    "db:migrate": "drizzle-kit migrate --force",
    "db:push": "drizzle-kit push --force",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Flag Rules

| Command | --force | Reason |
|---------|---------|--------|
| generate | YES | Prevent interactive prompts in CI |
| migrate | YES | Prevent interactive prompts in CI |
| push | YES | Prevent interactive prompts in CI |
| studio | NO | Interactive tool, no CI usage |

### Verification

```bash
# Check all drizzle commands (except studio) have --force
grep "drizzle-kit" package.json | grep -v "studio" | grep -v "\-\-force"
# Should return empty
```
```

---

### MED-QA-002: Environment Variable Documentation

**Issue Found:** .env.example doesn't clearly indicate which vars are required vs optional.

**Add to Agent 7 GPT:**

```markdown
## ENVIRONMENT DOCUMENTATION STANDARD

### .env.example Format

```bash
# ============================================
# REQUIRED - App will not start without these
# ============================================

# Database connection (PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT signing secret (min 32 characters)
JWT_SECRET=your-super-secret-key-min-32-chars

# ============================================
# OPTIONAL - Features disabled if not set
# ============================================

# Encryption for API keys (64 hex chars)
# Required if: Using third-party integrations
ENCRYPTION_KEY=

# Email service
# Required if: Sending emails (password reset, invitations)
EMAIL_ENABLED=false
EMAIL_API_KEY=

# ============================================
# DEFAULTS - Override if needed
# ============================================

PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000
```

### Checklist

- [ ] All required vars have `# REQUIRED` comment
- [ ] All optional vars indicate what feature they enable
- [ ] Default values shown for vars with defaults
- [ ] Minimum requirements noted (e.g., "min 32 chars")
```

---

### MED-QA-003: Health Check Verification

**Add to Agent 7 GPT:**

```markdown
## DEPLOYMENT HEALTH CHECK REQUIREMENTS

### Minimum Health Check Response

The `/api/health` endpoint MUST return:

```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-22T10:30:00.000Z",
    "version": "1.0.0",
    "checks": {
      "database": "connected"
    }
  },
  "meta": {
    "timestamp": "2026-01-22T10:30:00.000Z"
  }
}
```

### Deployment Verification Script

```bash
#!/bin/bash
response=$(curl -s http://localhost:5000/api/health)

# Check status
status=$(echo $response | jq -r '.data.status')
if [ "$status" != "healthy" ]; then
  echo "FAIL: Health status is $status"
  exit 1
fi

# Check database
db=$(echo $response | jq -r '.data.checks.database')
if [ "$db" != "connected" ]; then
  echo "FAIL: Database is $db"
  exit 1
fi

echo "PASS: Health check OK"
```
```

---

## Agent 2: Architecture GPT Improvements

### HIGH-ARCH-001: Token Refresh Strategy

**Issue Found:** No refresh token strategy defined in architecture.

**Add to Agent 2 GPT:**

```markdown
## AUTHENTICATION ARCHITECTURE

### Token Strategy (MANDATORY)

Every application MUST define token strategy:

**Option A: Short-lived Access + Refresh Token (Recommended)**
```
Access Token: 15 minutes, stored in memory
Refresh Token: 7 days, stored in httpOnly cookie

Flow:
1. Login → returns both tokens
2. API calls use access token
3. On 401 → call /refresh with refresh token
4. /refresh returns new access token
5. Retry original request
```

**Option B: Long-lived Access Token**
```
Access Token: 24 hours, stored in localStorage

Flow:
1. Login → returns access token
2. API calls use access token
3. On 401 → redirect to login
```

### Architecture Document Must Specify

- [ ] Token type (JWT/opaque)
- [ ] Access token expiry
- [ ] Refresh token expiry (if used)
- [ ] Storage location (memory/localStorage/cookie)
- [ ] Refresh endpoint defined
- [ ] Token rotation strategy
```

---

### MED-ARCH-002: Background Job Strategy

**Issue Found:** Background processing uses `setTimeout()` without proper job queue.

**Add to Agent 2 GPT:**

```markdown
## BACKGROUND PROCESSING ARCHITECTURE

### When to Use Job Queue

Use job queue (not setTimeout) when:
- Task takes > 30 seconds
- Task must survive server restart
- Task needs retry on failure
- Task status must be trackable

### Replit-Compatible Options

1. **In-memory queue (simple):**
   ```typescript
   // For single-instance deployments
   import PQueue from 'p-queue';
   const queue = new PQueue({ concurrency: 2 });
   ```

2. **Database-backed queue:**
   ```typescript
   // For persistence across restarts
   // Store jobs in 'jobs' table, poll for pending
   ```

### Architecture Document Must Specify

- [ ] Which operations are background tasks
- [ ] Queue implementation (in-memory/database/external)
- [ ] Retry strategy
- [ ] Failure handling
- [ ] Status tracking approach
```

---

## Summary: Top 10 Rules to Add

1. **Agent 4:** Mandatory auth refresh endpoint in every API Contract
2. **Agent 4:** Frontend-backend endpoint mapping table required
3. **Agent 6:** Ban Promise.all with database queries
4. **Agent 6:** Security vars must fail-fast, no defaults
5. **Agent 6:** All findMany must have LIMIT
6. **Agent 6:** Ban Math.random() in server code
7. **Agent 6:** Multi-step operations require transactions
8. **Agent 6:** All magic numbers in config
9. **Agent 5:** Two-step file upload flow specification
10. **Agent 7:** Health check must include version and db status

---

## Verification Checklist for Code Review Agent

Add these automated checks:

```bash
# 1. Check for Promise.all with db queries
grep -A 10 "Promise.all" server/**/*.ts | grep "db\."

# 2. Check for Math.random in server
grep -rn "Math\.random()" server/

# 3. Check for JWT fallback
grep -n "JWT_SECRET.*||" server/

# 4. Check for unbounded findMany
grep -rn "findMany" server/ | grep -v "limit"

# 5. Check for missing --force
grep "drizzle-kit" package.json | grep -v "studio" | grep -v "\-\-force"

# 6. Check for z.unknown
grep -rn "z\.unknown\|z\.any" server/

# 7. Check for type casting JSONB
grep -rn "as.*\[\]" server/services/
```

---

**Document Status:** COMPLETE

**Next Steps:**
1. Review and approve improvements for each agent
2. Update agent GPT prompts with new rules
3. Add verification patterns to Code Review Agent
4. Re-run audit after fixes to validate
