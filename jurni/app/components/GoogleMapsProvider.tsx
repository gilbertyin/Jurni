'use client';

import { LoadScript } from '@react-google-maps/api';
import { ReactNode } from 'react';

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export default function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
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
      libraries={['places']}
    >
      {children}
    </LoadScript>
  );
} 