'use client';

import { GoogleMap, Marker } from '@react-google-maps/api';
import { useState } from 'react';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060
};

const sampleWaypoints = [
  {
    id: '1',
    venue_name: 'Central Park',
    latitude: 40.7829,
    longitude: -73.9654
  },
  {
    id: '2',
    venue_name: 'Times Square',
    latitude: 40.7580,
    longitude: -73.9855
  },
  {
    id: '3',
    venue_name: 'Empire State Building',
    latitude: 40.7484,
    longitude: -73.9857
  }
];

export default function LandingMapPreview() {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onMapLoad = (map: google.maps.Map) => {
    setMap(map);
    // Fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    sampleWaypoints.forEach(waypoint => {
      bounds.extend({ lat: waypoint.latitude, lng: waypoint.longitude });
    });
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  };

  return (
    <div className="h-full w-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={12}
        onLoad={onMapLoad}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
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
            }
          ]
        }}
      >
        {sampleWaypoints.map((waypoint) => (
          <Marker
            key={waypoint.id}
            position={{ lat: waypoint.latitude, lng: waypoint.longitude }}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285F4"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12)
            }}
          />
        ))}
      </GoogleMap>
    </div>
  );
} 