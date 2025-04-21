'use client';

import { ReactNode } from 'react';

interface MapContainerProps {
  children: ReactNode;
}

export default function MapContainer({ children }: MapContainerProps) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="text-red-500">Google Maps API key is not configured</div>
      </div>
    );
  }

  return <>{children}</>;
} 