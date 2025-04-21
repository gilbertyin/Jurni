# Components

This directory contains reusable React components used throughout the application.

## MapView.tsx

The main map component that displays venues and user location on a Google Map.

### Features
- Interactive Google Map display
- Real-time venue markers
- User location tracking
- Zoom-based label visibility
- Info windows for venue details
- Real-time updates from Supabase

### Props
None - Component manages its own state

### State
- `waypoints`: Array of venue locations
- `selectedWaypoint`: Currently selected venue
- `mapCenter`: Current map center
- `zoomLevel`: Current zoom level
- `userLocation`: User's current location

## VenuesList.tsx

Displays a list of venues with their details and delete functionality.

### Features
- Real-time venue list
- Delete functionality
- Status indicators
- Real-time updates from Supabase

### Props
None - Component manages its own state

### State
- `venues`: Array of venues
- `loading`: Loading state
- `error`: Error state
- `deletingId`: ID of venue being deleted

## Usage

```tsx
// Example usage in a page
import MapView from '@/app/components/MapView';
import VenuesList from '@/app/components/VenuesList';

export default function Dashboard() {
  return (
    <div>
      <MapView />
      <VenuesList />
    </div>
  );
}
```

## Styling

Components use Tailwind CSS for styling. Custom styles can be added in the component files or through the Tailwind configuration. 