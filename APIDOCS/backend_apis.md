# FlightData Backend API Guide

This document lists every backend endpoint exposed by the FlightData FastAPI service so that frontend developers (and non‑technical collaborators) can integrate confidently. Unless noted otherwise:

* Base URL: `/` (e.g., `https://<backend-host>/api/...`).
* Authentication: Bearer JWT in `Authorization: Bearer <token>` for all `/api/*` routes except `/api/auth/login` and `/health`.
* Success responses are JSON. Dates are ISO‑8601 (`YYYY-MM-DD`); times are 24‑hour `HH:MM` strings.

## Health Check

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| GET | `/health` | Returns `{ "ok": true }` to verify the service is running. | None |

---

## Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Exchange email/password for a JWT access token. |

**Request body**
```json
{
  "email": "user@example.com",
  "password": "plaintext password"
}
```

**Successful response**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "email": "user@example.com",
  "role": "STUDENT" | "GD" | "DH" | "TL" | "SM" | "OIC" | "JRF" | "SRF" | "CE" | "ADMIN",
  "access_level_value": <number>
}
```
If credentials are invalid, a 401 is returned.

---

## Users (Admin only)
All user management endpoints require an **ADMIN** token. Emails are immutable identifiers.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/users` | Create a user. |
| GET | `/api/users` | List users with optional search and pagination. |
| GET | `/api/users/{email}` | Fetch a single user by email. |
| PATCH | `/api/users/{email}` | Update mutable fields of a user. |
| DELETE | `/api/users/{email}` | Remove a user account. |

**Create / Update payload fields**
- `first_name` (string, required for create)
- `last_name` (string, optional)
- `email` (Email, required for create)
- `password` (string, required for create; stored as provided)
- `role` (enum above; optional for update)
- `is_active` (boolean, default true)

**User response shape**
```json
{
  "first_name": "...",
  "last_name": "...",
  "email": "...",
  "role": "...",
  "access_level_value": <number>,
  "is_active": true,
  "created_at": "2024-04-01T12:00:00Z",
  "last_login_at": "2024-04-05T09:30:00Z"
}
```

List filtering supports `?page=1&limit=50&q=search&role=GD`.

---

## Projects
Projects are accessible only to authenticated members. Creating/updating/deleting requires a **GD** or **DH** token. Membership is checked for most operations.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/projects` | (GD/DH) Create a project with optional member emails. |
| GET | `/api/projects` | List projects the caller belongs to (paginated). |
| GET | `/api/projects/count` | Return `{ "total": number }` for caller's memberships. |
| GET | `/api/projects/member-search` | (GD/DH) Search all users by name/email for adding members. |
| GET | `/api/projects/{project_id}` | Get a project if the caller is a member. |
| PATCH | `/api/projects/{project_id}` | (GD/DH) Update name/description (must be a member). |
| PATCH | `/api/projects/{project_id}/members` | (GD/DH) Add/remove members. |
| DELETE | `/api/projects/{project_id}` | (GD/DH) Delete a project the caller belongs to. |

**Key fields**
- `project_name` (string)
- `project_description` (string, optional)
- `member_emails` (list of emails for creation)

**Project response**
```json
{
  "id": "...",
  "project_name": "...",
  "project_description": "...",
  "members": [{ "email": "member@example.com", "user_id": "..." }],
  "created_by": "creator@example.com",
  "created_at": "2024-04-01T12:00:00Z"
}
```

---

## Documents (personal library + Minutes of Meeting)
All document routes operate on the **current user’s** files and require auth. Sections are enumerated as:
- `inventory_records`, `divisional_records`, `customer_feedbacks`, `training_records`, `technical_reports`, `minutes_of_meeting`, `digital_library`

When `section` is `minutes_of_meeting`, a `subsection` of `tcm`, `pmrc`, `ebm`, or `gdm` is required.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/documents/init-upload` | Request a 1‑hour presigned PUT URL to upload a file. Rejects duplicates per user/section/hash. |
| POST | `/api/documents/confirm` | Register uploaded file metadata and MoM action items. Enforces duplicate check again. |
| GET | `/api/documents` | List documents for the caller in a section (optionally filter MoM subsection). |
| GET | `/api/documents/assignees` | Suggest assignee names from existing MoM action items (`?q=...&limit=10`). |
| GET | `/api/documents/{doc_id}/download-url` | Get a 1‑hour presigned GET URL for caller-owned doc. |
| PUT | `/api/documents/{doc_id}` | Update tag/date/action owners/action points for caller-owned doc. |
| DELETE | `/api/documents/{doc_id}` | Delete caller-owned doc and best-effort remove MinIO object. |

**Init upload payload** (key fields):
- `section` (enum above)
- `subsection` (MoM only)
- `tag` (user label)
- `doc_date` (date)
- `filename`, `content_type`, `size_bytes`, `content_hash`
- `action_points` (list of `{ description, assigned_to?, completed }`)
- `action_on` (list of assignee names)

Init response: `{ "upload_url", "storage_key", "bucket", "expires_in": 3600 }`.

**Confirm payload**: `section`, optional `subsection`, `tag`, `doc_date`, `storage_key`, `original_name`, `content_type`, `size_bytes`, `content_hash`, plus optional action fields.

**Document response**
```json
{
  "doc_id": "...",
  "owner_email": "user@example.com",
  "section": "minutes_of_meeting",
  "subsection": "tcm",
  "tag": "Sprint Review",
  "doc_date": "2024-04-01",
  "original_name": "minutes.pdf",
  "storage_key": "users/user@example.com/...",
  "size_bytes": 12345,
  "content_type": "application/pdf",
  "uploaded_at": "2024-04-01T12:00:00Z",
  "action_points": [{ "description": "Share slides", "assigned_to": "Alex", "completed": false }],
  "action_on": ["Alex"]
}
```

---

## Student Engagements
Per-user student engagement records and attachments.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/student-engagements/init-upload` | Presigned PUT URL for an attachment (deduped by content hash). |
| POST | `/api/student-engagements` | Create a student engagement record (optionally including upload metadata). |
| GET | `/api/student-engagements` | List caller’s records; filter by `approval_status` (`approved`/`waiting`). |
| PUT | `/api/student-engagements/{record_id}` | Update a record owned by the caller. |
| DELETE | `/api/student-engagements/{record_id}` | Delete record and best-effort delete attachment. |
| GET | `/api/student-engagements/{record_id}/download-url` | Presigned GET URL for caller-owned attachment. |

**Payload highlights**
- Student/program info: `student`, `college_name`, `project_name`, `program_type`, `mentor`
- Timing: `duration_months`, `start_date`, `end_date` (end cannot be before start)
- Status: `status`, `approval_status` (`waiting` default, or `approved`)
- Attachment metadata: `storage_key`, `original_name`, `content_type`, `size_bytes`, `content_hash`

Responses echo payload plus `record_id`, `owner_email`, `created_at`, `updated_at`.

---

## Records (inventory, divisional, customer feedback, technical, training)
Each section is isolated per user; all endpoints require auth. Duplicate uploads are prevented via `content_hash` when using `/{section}/init-upload`.

Common file metadata fields: `storage_key`, `original_name`, `content_type`, `size_bytes`, `content_hash`.

### Upload init
`POST /api/records/{section}/init-upload` (where `{section}` is `inventory-records`, `divisional-records`, `customer-feedbacks`, `technical-reports`, or `training-records`) returns `{ upload_url, storage_key, bucket, expires_in }` for a 1‑hour PUT to MinIO.

### Inventory Records
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/records/inventory-records` | Create a supply order record. |
| GET | `/api/records/inventory-records` | List caller’s supply orders. |
| PUT | `/api/records/inventory-records/{record_id}` | Update caller-owned supply order. |
| DELETE | `/api/records/inventory-records/{record_id}` | Delete record and attachment. |
| GET | `/api/records/inventory-records/{record_id}/download-url` | Presigned GET URL for attachment. |

Fields: `so_number`, `particular`, `supplier_name`, `quantity`, `duration_months`, `start_date`, `delivery_date` (cannot precede start), `duty_officer`, `holder`, `amount`, `status`, plus file metadata.

### Divisional Records
Similar patterns with fields `division_name`, `record_type`, `created_date`, `rating`, `remarks`, plus file metadata.

Routes: POST/GET/PUT/DELETE/GET download at `/api/records/divisional-records`.

### Customer Feedbacks
Fields: `project_name`, `division`, `feedback_from`, `rating`, `feedback_date`, `feedback_text`, plus file metadata.

Routes: POST/GET/PUT/DELETE/GET download at `/api/records/customer-feedbacks`.

### Technical Reports
Fields: `name`, `description`, `report_type`, `created_date`, `rating`, plus file metadata.

Routes: POST/GET/PUT/DELETE/GET download at `/api/records/technical-reports`.

### Training Records
Fields: `trainee_name`, `training_name`, `training_type`, `start_date`, `end_date` (cannot precede start), `status`, `remarks`, plus file metadata.

Routes: POST/GET/PUT/DELETE/GET download at `/api/records/training-records`.

All list endpoints return arrays of section-specific objects with `record_id`, `owner_email`, `created_at`, and `updated_at` in addition to the fields above.

---

## Ingestion (dataset uploads for projects)
All ingestion endpoints require membership in the target project.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/ingestion/{project_id}` | Upload a dataset file for a project; streams directly to MinIO and queues processing. Form fields: `dataset_type` (optional), `header_mode` (`file`/`none`/`custom`), `custom_headers` (JSON array when header_mode=`custom`), and file upload (`file`). |
| GET | `/api/ingestion/jobs/{job_id}` | Get ingestion job details (filename, status, progress, columns, sample rows, etc.). |
| GET | `/api/ingestion/jobs/{job_id}/download` | Presigned GET URL for the uploaded dataset. |
| DELETE | `/api/ingestion/jobs/{job_id}` | Delete a job and its stored object. |
| GET | `/api/ingestion/project/{project_id}` | List all ingestion jobs for a project. |
| GET | `/api/ingestion/jobs/{job_id}/stream` | Server-Sent Events stream of progress updates. |
| GET | `/api/ingestion/jobs/{job_id}/status` | Quick status/progress lookup (may read from Redis cache). |

**Create response**
```json
{
  "job_id": "...",
  "project_id": "...",
  "filename": "data.csv",
  "storage_key": "projects/<project_id>/...",
  "dataset_type": "...",
  "header_mode": "file",
  "status": "queued",
  "autoscale": { ... }
}
```

**Job response highlights**
- Identifiers: `job_id`, `project_id`, `storage_key`
- Status: `status`, `progress` (0-100), optional `message`
- Data preview: `sample_rows` (array of dicts), `columns`, `rows_seen`, `metadata`
- Timestamps: `created_at`, `updated_at`

---

## Visualizations
Visualizations are tied to a project; only members may access them. Visualizations are generated asynchronously from ingestion jobs.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/visualizations/` | Create a visualization request. Requires at least one series. Body includes `project_id`, `x_axis`, `chart_type`, and `series` array of `{ job_id, y_axis, label? }`. Validates dataset membership and column existence when known. Returns 202 with a queued visualization. |
| DELETE | `/api/visualizations/{viz_id}` | Delete visualization and stored artifacts. |
| GET | `/api/visualizations/{viz_id}` | Get visualization details; if available, presigned `html_url` and tile URLs are injected. |
| GET | `/api/visualizations/{viz_id}/tiles` | Retrieve tile data for a specific series/level with optional `x_min`/`x_max` filters. |
| GET | `/api/visualizations/{viz_id}/status` | Lightweight status/progress. |
| GET | `/api/visualizations/{viz_id}/download` | Presigned GET URL for the rendered HTML output. |
| GET | `/api/visualizations/project/{project_id}` | List all visualizations for a project, skipping malformed records. |

**Visualization response (hydrated)**
```json
{
  "viz_id": "...",
  "project_id": "...",
  "x_axis": "time",
  "chart_type": "scatter",
  "series": [ { "job_id": "...", "y_axis": "altitude", "label": "Altitude", "filename": "data.csv" } ],
  "status": "queued|processing|ready|failed",
  "progress": 0,
  "message": "...",
  "html_url": "https://...",   // when available
  "tiles": [ { "series": {...}, "tiles": [ {"level":0, "object_name":"...", "rows":123, "url":"https://..."} ] } ],
  "series_stats": [...],
  "created_at": "...",
  "updated_at": "..."
}
```

**Tile fetch response** includes filtered data rows and metadata about the selected tile.

---

## Notifications
Notifications are user-specific.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/notifications` | List recent notifications for the caller (`limit` 1-100, default 25). |
| POST | `/api/notifications` | Create a notification for the caller. Body: `title?`, `message` (required), `category` (default `general`), `link?`. |
| PATCH | `/api/notifications/{notification_id}/read` | Mark a notification as read then delete it from the user’s inbox. |
| POST | `/api/notifications/read-all` | Mark all as read and delete for the caller. |

Responses include `id`, `user_email`, `title`, `message`, `category`, `link`, `is_read`, and `created_at`.

---

## Meetings (next meeting reminders)
Supports scheduling the next meeting for Minutes of Meeting (MoM) documents.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/meetings/next` | Fetch the caller’s next meeting for a section/subsection (defaults to MoM `tcm`). |
| PUT | `/api/meetings/next` | Upsert the next meeting info for MoM (`section` must be `minutes_of_meeting`). |

**Payload fields**
- `section` (only `minutes_of_meeting` allowed; defaults accordingly)
- `subsection` (`tcm` default)
- `title` (optional string)
- `meeting_date` (date)
- `meeting_time` (`HH:MM` 24-hour string)

Response echoes payload plus `updated_at` and `owner_email`.

---

## API Usage Tips
- **Authorization header**: `Authorization: Bearer <access_token>` is mandatory for all endpoints except `/health` and `/api/auth/login`.
- **Content hashes** are used widely to prevent duplicate uploads—compute a stable hash of the file contents on the client.
- **MinIO presigned URLs** expire after one hour; upload/download within that window.
- **Access control**: Project endpoints enforce membership; some actions require `GD` or `DH` roles. User CRUD is `ADMIN` only.

