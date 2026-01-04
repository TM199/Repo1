# Job Ingestion Redesign Plan

## Problem
Current approach tries to fetch all jobs at once:
- 13 roles × 7 locations = 91 API calls
- Up to 500 jobs per search = 45,500 potential jobs
- Causes timeouts and connection resets

## Solution: Distributed Daily Ingestion

### Approach
Instead of one massive job sync at 6 AM, we'll:
1. **Queue individual tasks** for each role+location combination
2. **Process one task every 20 minutes** throughout the day
3. Each task is small and fast (1 role × 1 location)
4. Full coverage over 24 hours

### Implementation Steps

#### 1. Create Job Queue Table (if not exists)
Store pending ingestion tasks:
```sql
- id
- role (keyword)
- location
- source (reed | adzuna)
- status (pending | processing | completed | failed)
- scheduled_for (timestamp)
- created_at
- completed_at
```

#### 2. Daily Scheduler Function (6 AM)
**Job**: Create queue entries for the day
- Get all active ICP profiles with job_pain enabled
- Extract unique role+location combinations
- Create queue entries distributed throughout the day
- Schedule one task every 20 mins (72 tasks per day max)

#### 3. Ingestion Worker Function (Every 20 mins)
**Job**: Process ONE queue entry
- Pick next pending task from queue
- Fetch jobs for that specific role+location
- Process jobs (create companies, detect reposts, etc.)
- Mark task as completed
- Small, fast, no timeouts

#### 4. Benefits
- ✅ No timeouts (small batches)
- ✅ Full data coverage over 24 hours
- ✅ Can fetch 365 days of history per role
- ✅ Automatic retry on failure
- ✅ Progress tracking
- ✅ Doesn't overwhelm APIs

### Example Schedule
```
6:00 AM - Queue 91 tasks (13 roles × 7 locations)
6:00 AM - Process: Software Engineer × London (Reed)
6:20 AM - Process: Software Engineer × London (Adzuna)
6:40 AM - Process: Software Engineer × Manchester (Reed)
7:00 AM - Process: Software Engineer × Manchester (Adzuna)
...continues throughout day
```

## Next Steps
1. ✅ Review this plan
2. Create ingestion queue table migration
3. Create scheduler function (queues tasks)
4. Create worker function (processes one task)
5. Update existing ingest-jobs to use new system
6. Test with one ICP profile
7. Deploy

