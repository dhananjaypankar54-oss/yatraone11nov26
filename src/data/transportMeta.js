import { Bus, TrainFront, Car, Bike } from 'lucide-react'

// NOTE: "Auto" uses the Bike icon glyph only because lucide has no dedicated
// auto-rickshaw icon — YatraOne does NOT support two-wheeler ride bookings.
export const TRANSPORT_META = {
  BUS: { label: 'Bus', icon: Bus, color: '#3654F4', path: '/bus' },
  TRAIN: { label: 'Train', icon: TrainFront, color: '#7089FF', path: '/train' },
  TAXI: { label: 'Taxi', icon: Car, color: '#FFB020', path: '/private-transport' },
  AUTO: { label: 'Auto', icon: Bike, color: '#17D492', path: '/private-transport' },
}
