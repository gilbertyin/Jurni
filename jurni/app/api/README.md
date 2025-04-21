# API Routes

This directory contains Next.js API routes that handle server-side operations.

## videos/route.ts

Handles video submission and processing.

### Endpoints

#### POST /api/videos

Submits a new video URL for processing.

##### Request Body
```typescript
{
  url: string;      // Video URL to process
  userId: string;   // ID of the submitting user
}
```

##### Response
```typescript
{
  id: string;       // Video ID
  user_id: string;  // User ID
  url: string;      // Video URL
  status: string;   // Initial status ('queued')
  created_at: string; // ISO timestamp
}
```

##### Error Response
```typescript
{
  error: string;    // Error message
}
```

### Process Flow

1. Receives video URL and user ID
2. Creates database entry with 'queued' status
3. Adds job to Redis queue for processing
4. Returns created video entry

### Dependencies
- Supabase for database operations
- BullMQ for job queuing
- Redis for queue storage

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

## Usage Example

```typescript
const response = await fetch('/api/videos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://example.com/video',
    userId: 'user123'
  })
});

const data = await response.json();
``` 