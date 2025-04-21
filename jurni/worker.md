# Worker Process

The worker process handles background jobs for video processing and analysis.

## Overview

The worker is a Node.js process that:
1. Processes video URLs from the queue
2. Downloads and analyzes videos
3. Extracts location and venue information
4. Updates the database with results

## Features

- Video downloading and processing
- Metadata extraction
- AI-powered location analysis
- Rate limiting for external APIs
- Error handling and retries
- Logging and monitoring

## Job Types

### process-video
Processes a single video URL.

#### Job Data
```typescript
{
  videoId: string;    // Database ID of the video
  userId: string;     // ID of the submitting user
  videoUrl: string;   // URL of the video to process
}
```

#### Process Flow
1. Download video
2. Extract metadata
3. Analyze with Gemini AI
4. Geocode venue location
5. Update database

## Rate Limiting

The worker implements rate limiting for:
- YouTube-DL downloads
- Gemini AI analysis
- Google Maps geocoding

## Error Handling

- Automatic retries with exponential backoff
- Error logging to worker.log
- Status updates in database

## Dependencies

- BullMQ for job processing
- Redis for queue storage
- yt-dlp for video downloading
- Google Gemini AI for analysis
- Google Maps API for geocoding
- Supabase for database operations

## Environment Variables

- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

## Starting the Worker

```bash
npm run worker
```

## Logging

Logs are written to `worker.log` in the project root.

## Monitoring

Monitor the worker through:
- Redis queue status
- Database status updates
- Log file analysis 