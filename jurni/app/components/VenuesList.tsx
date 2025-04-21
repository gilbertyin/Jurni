'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { FaTrash } from 'react-icons/fa'

interface Venue {
  id: string
  venue_name: string
  city_name: string
  country_name: string
  url: string
  status: string
  latitude: number
  longitude: number
}

interface VenuesListProps {
  onVenueSelect?: (venue: Venue | null) => void;
}

export default function VenuesList({ onVenueSelect }: VenuesListProps) {
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const supabase = createClient()

  const handleVenueSelect = (venue: Venue) => {
    setSelectedVenue(venue);
    if (onVenueSelect) {
      onVenueSelect(venue);
    }
  }

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, venue_name, city_name, country_name, url, status, latitude, longitude')
        .order('created_at', { ascending: false })

      if (error) throw error

      setVenues(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch venues')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (venueId: string) => {
    try {
      setDeletingId(venueId)
      console.log('Attempting to delete venue:', venueId)
      
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', venueId)
        .select()

      if (error) {
        console.error('Delete error:', error)
        throw error
      }

      console.log('Successfully deleted venue:', venueId)
    } catch (err) {
      console.error('Delete operation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete venue')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    fetchVenues()

    const channel = supabase
      .channel('venues_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos'
        },
        (payload) => {
          console.log('Received real-time update:', payload)
          fetchVenues()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  if (loading) {
    return <div className="text-center py-4">Loading venues...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  return (
    <div className="space-y-2">
      {venues.map((venue) => (
        <div
          key={venue.id}
          className={`bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
            venue.status !== 'completed' ? 'opacity-50' : ''
          } ${selectedVenue?.id === venue.id ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => venue.status === 'completed' && handleVenueSelect(venue)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className={`font-medium ${
                venue.status !== 'completed' ? 'text-gray-500' : 'text-gray-900'
              }`}>
                {venue.status !== 'completed' ? venue.url : venue.venue_name}
              </p>
              {venue.status === 'completed' && (
                <p className="text-gray-400">
                  {venue.city_name}, {venue.country_name}
                </p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(venue.id);
              }}
              disabled={deletingId === venue.id || venue.status !== 'completed'}
              className={`text-red-500 hover:text-red-700 transition-colors p-2 rounded-full hover:bg-red-50 ${
                (deletingId === venue.id || venue.status !== 'completed') 
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
              }`}
              title={venue.status !== 'completed' ? 'Processing...' : 'Delete venue'}
            >
              <FaTrash className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
} 