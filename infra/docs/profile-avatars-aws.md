# Profile avatars (scalable storage)

The API stores **`User.profilePicture` as a public URL** (same pattern as signup’s optional image URL).

## Default: local disk (development / small deploys)

- Upload: `POST /api/auth/me/avatar` (multipart field `avatar`, max **2 MB**, JPEG / PNG / WebP).
- Files live under `backend/data/avatars/{userId}/` (gitignored).
- Public URL shape: `https://<host>/api/media/avatars/<userId>/<uuid>.<ext>` (served by the backend).

No extra infrastructure is required.

## Production on AWS: S3 + CDN URL

When the backend has object-write access to a dedicated bucket, set:

| Variable | Purpose |
|----------|---------|
| `AVATAR_S3_BUCKET` | Bucket name (e.g. `myapp-avatars-prod`). |
| `AWS_REGION` | Region for `S3Client` (or `AWS_DEFAULT_REGION`). |
| `AVATAR_PUBLIC_BASE_URL` | **HTTPS base** returned to clients and stored in Postgres — no trailing slash. Use a **CloudFront distribution** (or stable public origin) that can read objects from this bucket, e.g. `https://d111111abcdef8.cloudfront.net`. |

The app uploads to key `avatars/{userId}/{uuid}.{ext}` and stores:

`{AVATAR_PUBLIC_BASE_URL}/avatars/{userId}/{uuid}.{ext}`

### IAM (ECS task role)

Grant the **task role** (not only the execution role) used by the Fargate service:

- `s3:PutObject` on `arn:aws:s3:::AVATAR_S3_BUCKET/avatars/*`

The execution role alone is not enough for application code to call S3.

### Bucket & CDN (high level)

1. Create an S3 bucket for user-generated avatars (separate from the static **frontend** bucket in `modules/s3`).
2. Prefer **private bucket + CloudFront OAC** (or public-read only on `avatars/*` if you accept simpler, less strict setup).
3. Point `AVATAR_PUBLIC_BASE_URL` at the CloudFront URL so URLs stay stable if you change buckets or origins later.

### Optional

- `AVATAR_LOCAL_PATH` — override local avatar directory (defaults to `data/avatars` under the backend cwd).

## Why not presigned browser PUT only?

Direct browser → S3 uploads are great at scale but require CORS, size checks client-side, virus scanning hooks, and a second “confirm” step to write the final URL into Postgres. The current design keeps **one authenticated request** that validates bytes, writes storage, and updates the user row; you can swap the storage driver from disk to S3 with env only.
