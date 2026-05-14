'use client'

import { useEffect, useRef } from 'react'

export interface TruckMarker {
  id: string
  unitNumber: string
  lat: number
  lon: number
  isActive: boolean
}

interface Props {
  trucks: TruckMarker[]
  height?: number
}

export function FleetMap({ trucks, height = 240 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let L: typeof import('leaflet')
    let cleanup = false

    async function init() {
      L = await import('leaflet')
      if (cleanup || !containerRef.current) return

      // Fix default marker icon path broken by bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const validTrucks = trucks.filter(t => t.lat !== 0 || t.lon !== 0)
      const center: [number, number] = validTrucks.length > 0
        ? [validTrucks[0].lat, validTrucks[0].lon]
        : [39.8283, -98.5795] // geographic center of the US

      const map = L.map(containerRef.current!, {
        center,
        zoom: validTrucks.length > 0 ? 6 : 4,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map)

      const activeIcon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:#15233D;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })
      const inactiveIcon = L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;border-radius:50%;background:#9CA3AF;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })

      for (const t of validTrucks) {
        L.marker([t.lat, t.lon], { icon: t.isActive ? activeIcon : inactiveIcon })
          .bindTooltip(`<strong>${t.unitNumber}</strong>`, { permanent: false, direction: 'top' })
          .addTo(map)
      }

      if (validTrucks.length > 1) {
        const bounds = L.latLngBounds(validTrucks.map(t => [t.lat, t.lon] as [number, number]))
        map.fitBounds(bounds, { padding: [32, 32] })
      }

      mapRef.current = map
    }

    void init()
    return () => {
      cleanup = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} style={{ height, width: '100%', borderRadius: '0 0 12px 12px', overflow: 'hidden' }} />
    </>
  )
}
