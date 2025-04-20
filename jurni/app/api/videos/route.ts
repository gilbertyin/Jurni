import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import { NextResponse } from 'next/server';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const videoQueue = new Queue('video-processing', {
  connection: redisConnection,
});

export async function POST(request: Request) {
  try {
    const { url, userId } = await request.json();

    // Create database entry
    const { data, error } = await supabase
      .from('videos')
      .insert([
        {
          user_id: userId,
          url,
          status: 'queued',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to create video entry: ${error.message}`);
    }

    // Add to queue
    await videoQueue.add('process-video', {
      videoId: data.id,
      userId,
      videoUrl: url,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
} 