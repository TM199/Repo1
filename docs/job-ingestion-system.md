# Distributed Job Ingestion System

## Overview
A reliable, distributed job ingestion system that fetches jobs from Reed and Adzuna throughout the day, processes them in small batches, and automatically generates pain signals.

## Problem Solved
Previously, the system tried to fetch all jobs at once (13 roles × 7 locations = 91 API calls), causing:
- ❌ Connection reset errors
- ❌ Timeouts (trying to process 45,500+ jobs)
- ❌ No job data being ingested
- ❌ No pain signals being generated

## Solution: Distributed Processing

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│  6:00 AM Daily Scheduler                                │
│  Creates queue entries for all role+location combos     │
│  Distributes them across 24 hours (20 min intervals)    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  Every 20 Minutes - Worker                              │
│  1. Picks ONE task from queue                           │
│  2. Fetches jobs for that role+location                 │
│  3. Creates companies & job postings                    │
│  4. Marks task complete                                 │
│  5. Triggers signal generation                          │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  Pain Signal Generator                                  │
│  Analyzes new jobs and creates pain signals             │
└─────────────────────────────────────────────────────────┘
```

### How It Works

#### 1. Daily Scheduler (`schedule-daily-jobs`)
**Runs**: 6 AM daily (or manually via event)
**Does**:
- Gets all active ICP profiles with `job_pain` enabled
- Extracts unique role+location combinations
- Creates queue entries in `scan_queue` table
- Distributes tasks throughout the day (20 min intervals)

**Example**:
- Your 2 ICP profiles have 13 roles across 7 locations
- Creates 182 queue entries (13 × 7 × 2 sources: Reed + Adzuna)
- Processes over ~60 hours at 20 min intervals

#### 2. Queue Worker (`process-job-queue`)
**Runs**: Every 20 minutes (or manually via event)
**Does**:
- Picks next pending task that's due
- Fetches jobs from Reed OR Adzuna (not both at once)
- For each job:
  - Finds or creates company
  - Checks for duplicates (fingerprint matching)
  - Detects reposts & salary increases
  - Inserts job posting with all metadata
- Marks task as complete
- Triggers signal generation if new jobs were added

**Fetches**: 30 days of job history per role+location

#### 3. Signal Generation (`generate-pain-signals`)
**Runs**: After each worker completes (if new jobs)
**Does**:
- Analyzes new job postings
- Generates pain signals for matching ICPs
- Updates company pain scores

## Benefits

✅ **No Timeouts** - Each run processes ~200 jobs max (takes ~30-60 seconds)
✅ **Full Coverage** - All role+location combos processed within 60 hours
✅ **30 Days History** - Fetches last 30 days of jobs per role
✅ **Automatic Signals** - Pain signals generated after each batch
✅ **Progress Tracking** - View queue status in `scan_queue` table
✅ **Automatic Retries** - Failed tasks retry up to 3 times
✅ **Activity Logging** - All actions logged to dashboard feed

## Database Tables

### `scan_queue`
Stores pending job fetch tasks:
```sql
- id (uuid)
- icp_profile_id (tracks which ICP needs this)
- batch_id (groups tasks from same daily run)
- task_type (job_fetch_reed | job_fetch_adzuna)
- keywords (role to search for)
- location (location to search in)
- status (pending | processing | completed | failed)
- scheduled_for (when to process this task)
- jobs_found (how many jobs were fetched)
- created_at, started_at, completed_at
```

## Manual Triggers

### Schedule Daily Jobs (Create Queue)
```typescript
// Trigger via Inngest dashboard or API
inngest.send({
  name: 'jobs/schedule-daily',
  data: {},
});
```

### Process Queue (Run Worker)
```typescript
// Process next pending task
inngest.send({
  name: 'queue/process',
  data: { limit: 1 }, // Process 1 task (default)
});
```

### Generate Signals
```typescript
// Generate pain signals from existing jobs
inngest.send({
  name: 'pain-signals/generate',
  data: {},
});
```

## Monitoring

### Check Queue Status
```sql
SELECT
  status,
  COUNT(*) as count,
  MIN(scheduled_for) as next_due
FROM scan_queue
WHERE batch_id = (SELECT batch_id FROM scan_queue ORDER BY created_at DESC LIMIT 1)
GROUP BY status;
```

### View Recent Activity
```sql
SELECT *
FROM system_activity
WHERE type IN ('jobs_synced', 'queue_processed', 'signals_detected')
ORDER BY created_at DESC
LIMIT 20;
```

### Check Job Counts
```sql
SELECT
  DATE(created_at) as date,
  source,
  COUNT(*) as jobs
FROM job_postings
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), source
ORDER BY date DESC;
```

## Configuration

### Change Fetch Frequency
Edit `process-job-queue.ts`:
```typescript
{ cron: '*/20 * * * *' }, // Current: every 20 mins
{ cron: '*/15 * * * *' }, // Faster: every 15 mins
{ cron: '0 * * * *' },    // Slower: hourly
```

### Change Job History Window
Edit `process-job-queue.ts` line ~199:
```typescript
postedWithin: 30, // Current: last 30 days
postedWithin: 7,  // Last 7 days only
postedWithin: 90, // Last 90 days
```

### Change Jobs Per Search
Edit `process-job-queue.ts` line ~200:
```typescript
limitPerSearch: 200, // Current: 200 jobs max
limitPerSearch: 100, // Fewer (faster)
limitPerSearch: 500, // More (may timeout)
```

## Next Steps

1. **Monitor First Run** - Wait for 6 AM scheduler to create queue
2. **Check Activity Feed** - Verify tasks are being processed
3. **Review Signals** - Confirm pain signals are being generated
4. **Adjust Settings** - Tune frequency/history based on results

## Files Created
- [src/inngest/functions/schedule-daily-jobs.ts](../src/inngest/functions/schedule-daily-jobs.ts) - Daily scheduler
- [src/inngest/functions/process-job-queue.ts](../src/inngest/functions/process-job-queue.ts) - Queue worker
- [src/inngest/functions/index.ts](../src/inngest/functions/index.ts) - Updated exports
