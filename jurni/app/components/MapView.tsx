'use client';

import { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { createClient } from '@/lib/supabase';

// Verify environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is not defined');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
}
if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
  console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not defined');
}

const supabase = createClient();

// Test Supabase connection
supabase.from('videos').select('*', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log('Supabase connection test successful');
    }
  });

const containerStyle = {
  width: '100%',
  height: '600px'
};

const defaultCenter = {
  lat: 0,
  lng: 0
};

interface Waypoint {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  venue_name: string;
  city_name: string;
  country_name: string;
}

export default function MapView() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function fetchWaypoints() {
      console.log('Fetching waypoints...');
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      try {
        const { data, error, count } = await supabase
          .from('videos')
          .select('*')
          .order('created_at', { ascending: false });

        console.log('Supabase response:', { data, error, count });

        if (error) {
          console.error('Supabase error:', error);
          setError(`Database error: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.log('No videos found in database');
          setError('No videos found in database');
          return;
        }

        console.log('Total videos found:', data.length);
        console.log('Sample video data:', data[0]);
        
        // Filter videos with valid coordinates
        const videosWithCoordinates = data.filter(video => 
          video.latitude !== null && 
          video.longitude !== null
        );

        console.log('Videos with coordinates:', videosWithCoordinates.length);
        
        if (videosWithCoordinates.length > 0) {
          setWaypoints(videosWithCoordinates);
          const firstWaypoint = videosWithCoordinates[0];
          console.log('Setting map center to:', firstWaypoint);
          setMapCenter({
            lat: firstWaypoint.latitude,
            lng: firstWaypoint.longitude
          });
        } else {
          console.log('No videos found with coordinates');
          setError('No videos found with coordinates');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    fetchWaypoints();
  }, []);

  if (error) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="text-red-500">Google Maps API key is not configured</div>
      </div>
    );
  }

  return (
    <LoadScript 
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      onLoad={() => setIsLoaded(true)}
      onError={(err) => {
        console.error('Google Maps failed to load:', err);
        setError('Failed to load Google Maps');
      }}
    >
      {isLoaded && (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={3}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          {waypoints.map((waypoint) => (
            <Marker
              key={waypoint.id}
              position={{
                lat: waypoint.latitude,
                lng: waypoint.longitude
              }}
              onClick={() => setSelectedWaypoint(waypoint)}
            />
          ))}

          {selectedWaypoint && (
            <InfoWindow
              position={{
                lat: selectedWaypoint.latitude,
                lng: selectedWaypoint.longitude
              }}
              onCloseClick={() => setSelectedWaypoint(null)}
            >
              <div className="p-2">
                <h3 className="font-bold">{selectedWaypoint.venue_name}</h3>
                <p>{selectedWaypoint.title}</p>
                <p className="text-sm text-gray-600">
                  {selectedWaypoint.city_name}, {selectedWaypoint.country_name}
                </p>
                <p className="text-sm mt-2">{selectedWaypoint.description}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
    </LoadScript>
  );
} 