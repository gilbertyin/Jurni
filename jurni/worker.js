import { Worker, Queue } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Set up logging
const logFile = path.join(__dirname, 'worker.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  logStream.write(logMessage);
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

console.log('Starting worker...');
log('Starting worker...');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

log(`Redis connection config: ${JSON.stringify(redisConnection)}`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create a temporary directory for downloads if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Rate limiting configuration
const RATE_LIMITS = {
  ytDlp: {
    maxRequests: 5,
    timeWindow: 60 * 1000, // 1 minute
  },
  gemini: {
    maxRequests: 60,
    timeWindow: 60 * 1000, // 1 minute
  },
  googleMaps: {
    maxRequests: 50,
    timeWindow: 60 * 1000, // 1 minute
  }
};

// Retry configuration
const RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // Start with 1 second
  }
};

// Create separate queues for each rate-limited operation
const ytDlpQueue = new Queue('yt-dlp-downloads', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: RETRY_CONFIG.attempts,
    backoff: RETRY_CONFIG.backoff,
  }
});

const geminiQueue = new Queue('gemini-analysis', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: RETRY_CONFIG.attempts,
    backoff: RETRY_CONFIG.backoff,
  }
});

const googleMapsQueue = new Queue('google-maps-geocoding', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: RETRY_CONFIG.attempts,
    backoff: RETRY_CONFIG.backoff,
  }
});

// Rate limiting middleware
async function withRateLimit(queue, operation, fn) {
  const now = Date.now();
  const jobs = await queue.getJobs(['active', 'waiting', 'delayed']);
  
  // Count jobs in the time window
  const recentJobs = jobs.filter(job => 
    now - job.timestamp < RATE_LIMITS[operation].timeWindow
  );
  
  if (recentJobs.length >= RATE_LIMITS[operation].maxRequests) {
    // Calculate delay until next available slot
    const oldestJob = recentJobs[0];
    const delay = oldestJob.timestamp + RATE_LIMITS[operation].timeWindow - now;
    
    // Add to queue with delay
    return queue.add(operation, { fn }, { delay });
  }
  
  // Execute immediately if under rate limit
  return fn();
}

// Modified download function with rate limiting
async function downloadVideo(url, outputPath) {
  return withRateLimit(ytDlpQueue, 'ytDlp', async () => {
    const isTikTok = url.includes('tiktok.com');
    const ytdlpOptions = [
      '-f "best[ext=mp4]"',
      '--no-warnings',
      '--no-check-certificates',
      isTikTok ? '--cookies-from-browser chrome' : '',
      isTikTok ? '--force-keyframes-at-cuts' : '',
      `--output "${outputPath}"`,
    ].filter(Boolean).join(' ');

    try {
      const { stdout, stderr } = await execAsync(`yt-dlp ${ytdlpOptions} "${url}"`);
      if (stderr) console.error('Download stderr:', stderr);
      
      if (!fs.existsSync(outputPath)) {
        throw new Error('Video file was not created after download');
      }
      
      return true;
    } catch (error) {
      if (isTikTok) {
        try {
          await execAsync(`yt-dlp --no-warnings --force-generic-extractor "${url}" -o "${outputPath}"`);
          return true;
        } catch (altError) {
          throw altError;
        }
      }
      throw error;
    }
  });
}

async function updateVideoStatus(videoId, status) {
  log(`[DEBUG] Attempting to update video ${videoId} status to ${status}`);
  log(`[DEBUG] Using Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  log(`[DEBUG] Using Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing'}`);
  
  const { data, error } = await supabase
    .from('videos')
    .update({ status })
    .eq('id', videoId)
    .select();

  if (error) {
    log(`[ERROR] Failed to update video ${videoId} status to ${status}: ${JSON.stringify(error)}`);
    log(`[ERROR] Error details: ${JSON.stringify({
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    })}`);
    throw error;
  }

  log(`[DEBUG] Successfully updated video ${videoId} status to ${status}`);
  log(`[DEBUG] Update response: ${JSON.stringify(data)}`);
  return data;
}

async function extractMetadata(url) {
  log(`[DEBUG] Extracting metadata for video: ${url}`);
  const command = `yt-dlp --dump-json "${url}"`;
  
  try {
    const { stdout } = await execAsync(command);
    const metadata = JSON.parse(stdout);
    
    log(`[DEBUG] Extracted metadata: ${JSON.stringify(metadata)}`);
    return {
      title: metadata.title,
      description: metadata.description,
      duration: metadata.duration,
      uploader: metadata.uploader,
      upload_date: metadata.upload_date,
      view_count: metadata.view_count,
      like_count: metadata.like_count,
      comment_count: metadata.comment_count
    };
  } catch (error) {
    log(`[ERROR] Failed to extract metadata: ${error}`);
    throw error;
  }
}

// Modified Gemini processing with rate limiting
async function processWithGemini(videoPath, metadata) {
  return withRateLimit(geminiQueue, 'gemini', async () => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const videoData = fs.readFileSync(videoPath);
    
    // Create a prompt that includes both metadata and video analysis
    const prompt = `
      Analyze this video and its metadata to extract location and venue information.
      
      Video Metadata:
      Title: ${metadata.title}
      Description: ${metadata.description}
      
      Please watch the video and use the metedata to provide a JSON response with the following structure:
      {
        "country_name": "The country name that the video is about based on visual content, title, and description. Put 'unknown' if you can't determine the country.",
        "city_name": "The city name that the video is about based on visual content, title, and description. Put 'unknown' if you can't determine the city.",
        "summary": "A short summary of the venue based on visual content, title, and description that discusseses the price, pros and cons and other important details",
        "venue_name": "The name of the venue based on visual content, title, and description. Put 'unknown' if you can't determine the venue name.",
      }
      
      IMPORTANT: Return ONLY the JSON object, without any markdown formatting or additional text.
    `;
    
    try {
      // Create a multimodal prompt with both text and video
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "video/mp4",
            data: videoData.toString('base64')
          }
        }
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      log(`[DEBUG] Raw Gemini AI response: ${text}`);
      
      // Clean the response by removing markdown code blocks and any surrounding text
      const cleanedText = text
        .replace(/```json\n?/g, '')  // Remove ```json
        .replace(/```\n?/g, '')      // Remove ```
        .trim();                     // Remove any extra whitespace
      
      log(`[DEBUG] Cleaned response: ${cleanedText}`);
      
      return JSON.parse(cleanedText);
    } catch (error) {
      log(`[ERROR] Failed to process with Gemini AI: ${error}`);
      throw error;
    }
  });
}

// Modified geocoding with rate limiting
async function geocodeVenue(venueName, countryName, cityName) {
  return withRateLimit(googleMapsQueue, 'googleMaps', async () => {
    if (venueName === 'unknown' || countryName === 'unknown' || cityName === 'unknown') {
      return { latitude: null, longitude: null };
    }

    try {
      const searchQuery = `${venueName}, ${cityName}, ${countryName}`;
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: searchQuery,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng
        };
      }
      return { latitude: null, longitude: null };
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limit hit, will be retried by the queue
        throw error;
      }
      return { latitude: null, longitude: null };
    }
  });
}

async function updateVideoMetadata(videoId, metadata, geminiAnalysis) {
  log(`[DEBUG] Updating video metadata, analysis and coordinates for ${videoId}`);
  
  // Geocode the venue
  const coordinates = await geocodeVenue(geminiAnalysis.venue_name, geminiAnalysis.country_name, geminiAnalysis.city_name);
  
  // Update all metadata, Gemini analysis and coordinates
  const { data, error } = await supabase
    .from('videos')
    .update({
      title: metadata.title,
      description: metadata.description,
      duration: metadata.duration,
      uploader: metadata.uploader,
      upload_date: metadata.upload_date,
      venue_name: geminiAnalysis.venue_name,
      country_name: geminiAnalysis.country_name,
      city_name: geminiAnalysis.city_name,
      gemini_analysis: geminiAnalysis,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude
    })
    .eq('id', videoId)
    .select();

  if (error) {
    log(`[ERROR] Failed to update video metadata, analysis and coordinates: ${JSON.stringify(error)}`);
    throw error;
  }

  log(`[DEBUG] Successfully updated video metadata, analysis and coordinates`);
  return data;
}

const worker = new Worker('video-processing', async (job) => {
  log(`[DEBUG] Starting job processing: ${job.id}`);
  log(`[DEBUG] Job data: ${JSON.stringify(job.data)}`);
  const { videoId, userId, videoUrl } = job.data;

  try {
    await updateVideoStatus(videoId, 'processing');

    // Extract metadata
    const metadata = await extractMetadata(videoUrl);
    log(`[DEBUG] Extracted metadata: ${JSON.stringify(metadata)}`);

    // Download the video
    const outputPath = path.join(tempDir, `${videoId}.mp4`);
    await downloadVideo(videoUrl, outputPath);
    log(`[DEBUG] Video downloaded to: ${outputPath}`);

    // Process with Gemini AI
    const geminiAnalysis = await processWithGemini(outputPath, metadata);
    log(`[DEBUG] Gemini analysis: ${JSON.stringify(geminiAnalysis)}`);

    // Update video metadata
    await updateVideoMetadata(videoId, metadata, geminiAnalysis);

    // Clean up
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      log(`[DEBUG] Temporary file deleted`);
    }

    await updateVideoStatus(videoId, 'completed');

  } catch (error) {
    log(`[ERROR] Error processing video: ${error}`);
    try {
      await updateVideoStatus(videoId, 'failed');
    } catch (updateError) {
      log(`[ERROR] Failed to update status to failed: ${updateError}`);
    }
    throw error;
  }
}, {
  connection: redisConnection,
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Worker started and listening for jobs...');