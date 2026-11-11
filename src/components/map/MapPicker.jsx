import { useMapEvents } from 'react-leaflet'
/** Click-to-pick child for <MapView>. onPick({lat,lng}) */
export default function MapPicker({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}
