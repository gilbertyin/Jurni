'use client';

import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, OverlayView } from '@react-google-maps/api';
import { createClient } from '@/lib/supabase';
import { FaHome } from 'react-icons/fa';

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
  gemini_analysis: {
    summary: string;
    visual_analysis?: {
      architecture_style?: string;
      interior_design?: string;
      crowd_density?: string;
      notable_features?: string[];
    };
  };
}

// Add custom marker styles
const customMarkerStyles = `
  .pulse-dot {
    width: 12px;
    height: 12px;
    background-color: #4285F4;
    border: 2px solid white;
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 0 rgba(66, 133, 244, 1);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(66, 133, 244, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(66, 133, 244, 0);
    }
  }
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = customMarkerStyles;
  document.head.appendChild(style);
}

// Custom PulsingMarker component
const PulsingMarker = ({ position }: { position: google.maps.LatLngLiteral }) => {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: -(width / 2),
        y: -(height / 2),
      })}
    >
      <div className="pulse-dot" />
    </OverlayView>
  );
};

export default function MapView() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isUserLocationActive, setIsUserLocationActive] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [lastLocationTime, setLastLocationTime] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(0);
  const LOCATION_CACHE_TIME = 30000; // 30 seconds
  const MIN_ZOOM_FOR_LABELS = 15; // Minimum zoom level to show labels

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    // Add zoom change listener
    map.addListener('zoom_changed', () => {
      setZoomLevel(map.getZoom() || 0);
    });
    // Set initial zoom level
    setZoomLevel(map.getZoom() || 0);
  }, []);

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    // Check if we have a recent cached location
    const now = Date.now();
    if (userLocation && (now - lastLocationTime) < LOCATION_CACHE_TIME) {
      console.log('Using cached location');
      if (map) {
        map.setCenter(userLocation);
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(userLocation);
        waypoints.forEach(waypoint => {
          bounds.extend({ lat: waypoint.latitude, lng: waypoint.longitude });
        });
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    const successCallback = (position: GeolocationPosition) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      console.log('Got new location:', location);
      setUserLocation(location);
      setLastLocationTime(Date.now());
      setIsUserLocationActive(true);
      setIsLocating(false);
      
      if (map) {
        map.setCenter(location);
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(location);
        waypoints.forEach(waypoint => {
          bounds.extend({ lat: waypoint.latitude, lng: waypoint.longitude });
        });
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    };

    const errorCallback = (error: GeolocationPositionError) => {
      try {
        console.log('Geolocation error details:', {
          code: error.code,
          message: error.message,
          type: error.PERMISSION_DENIED === error.code ? 'PERMISSION_DENIED' :
                error.POSITION_UNAVAILABLE === error.code ? 'POSITION_UNAVAILABLE' :
                error.TIMEOUT === error.code ? 'TIMEOUT' : 'UNKNOWN'
        });
      } catch (e) {
        // Silently handle any console logging errors
      }
      
      setIsLocating(false);
      
      let errorMessage = 'Could not get your location. ';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Please enable location services in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Location information is unavailable. Please check your device location settings.';
          // Try again with lower accuracy and cached position
          try {
            navigator.geolocation.getCurrentPosition(
              successCallback,
              (retryError) => {
                setLocationError(errorMessage);
              },
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000 // Accept cached position up to 5 minutes old
              }
            );
          } catch (e) {
            setLocationError(errorMessage);
          }
          return;
        case error.TIMEOUT:
          errorMessage += 'Location request timed out. Please try again.';
          try {
            setTimeout(() => {
              getUserLocation();
            }, 1000);
          } catch (e) {
            setLocationError(errorMessage);
          }
          break;
        default:
          errorMessage += 'Please try again.';
      }
      
      setLocationError(errorMessage);
    };

    navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallback,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // Accept cached position up to 5 minutes old
      }
    );
  }, [map, waypoints, userLocation, lastLocationTime]);

  useEffect(() => {
    if (waypoints.length > 0 && !isUserLocationActive) {
      getUserLocation();
    }
  }, [waypoints, getUserLocation, isUserLocationActive]);

  useEffect(() => {
    async function fetchWaypoints() {
      try {
        const { data, error, count } = await supabase
          .from('videos')
          .select('*')
          .order('created_at', { ascending: false });

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
        
        // Filter videos with valid coordinates
        const videosWithCoordinates = data.filter(video => 
          video.latitude !== null && 
          video.longitude !== null
        );
        
        if (videosWithCoordinates.length > 0) {
          setWaypoints(videosWithCoordinates);
          const firstWaypoint = videosWithCoordinates[0];
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

    // Subscribe to real-time changes
    const channel = supabase
      .channel('videos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos'
        },
        (payload) => {
          console.log('Received real-time update:', payload);
          if (payload.eventType === 'DELETE') {
            setWaypoints(prevWaypoints => 
              prevWaypoints.filter(waypoint => waypoint.id !== payload.old.id)
            );
          } else if (payload.eventType === 'INSERT') {
            const newVideo = payload.new as Waypoint;
            if (newVideo.latitude && newVideo.longitude) {
              setWaypoints(prevWaypoints => [newVideo, ...prevWaypoints]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedVideo = payload.new as Waypoint;
            setWaypoints(prevWaypoints => 
              prevWaypoints.map(waypoint => 
                waypoint.id === updatedVideo.id ? updatedVideo : waypoint
              )
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
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
        <div className="relative">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={zoomLevel}
            onLoad={onMapLoad}
            options={{
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
              styles: [
                {
                  featureType: "poi",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "transit",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "administrative",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "landscape",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "road",
                  elementType: "labels.text.fill",
                  stylers: [{ color: "#999999" }]
                },
                {
                  featureType: "road",
                  elementType: "labels.text.stroke",
                  stylers: [{ visibility: "off" }]
                }
              ]
            }}
          >
            {userLocation && <PulsingMarker position={userLocation} />}
            {waypoints.map((waypoint) => (
              <Marker
                key={waypoint.id}
                position={{ lat: waypoint.latitude, lng: waypoint.longitude }}
                onClick={() => setSelectedWaypoint(waypoint)}
                label={zoomLevel >= MIN_ZOOM_FOR_LABELS ? {
                  text: waypoint.venue_name,
                  className: 'venue-label',
                  color: '#000000',
                  fontSize: '14px',
                  fontWeight: 'bold',
                } : undefined}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285F4"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(24, 24),
                  anchor: new google.maps.Point(12, 12),
                  labelOrigin: new google.maps.Point(12, 30)
                }}
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
                <div className="p-2 max-w-xs">
                  <h3 className="font-bold text-lg mb-2">{selectedWaypoint.venue_name}</h3>
                  {selectedWaypoint.gemini_analysis?.summary && (
                    <div className="text-sm text-gray-700">
                      {selectedWaypoint.gemini_analysis.summary}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {selectedWaypoint.city_name}, {selectedWaypoint.country_name}
                  </div>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWaypoint.latitude},${selectedWaypoint.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Get Directions
                  </a>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
          <button
            onClick={getUserLocation}
            className="absolute bottom-4 left-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
            title="Go to my location"
            disabled={isLocating}
          >
            <FaHome className={`text-blue-500 text-xl ${isLocating ? 'animate-pulse' : ''}`} />
          </button>
          {locationError && (
            <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg text-red-500 text-sm">
              {locationError}
            </div>
          )}
        </div>
      )}
    </LoadScript>
  );
} 