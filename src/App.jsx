import React from 'react'
import { Routes, Route } from 'react-router-dom'

import UserLayout from './layouts/UserLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import DriverLayout from './layouts/DriverLayout.jsx'
import { RequireUser, RequireAdmin, RequireDriver, RequireViewer } from './components/ProtectedRoute.jsx'

import Landing from './pages/Landing.jsx'
import Login from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'
import AdminLogin from './pages/auth/AdminLogin.jsx'
import DriverLogin from './pages/auth/DriverLogin.jsx'
import RegisterPrivate from './pages/auth/RegisterPrivate.jsx'

import Dashboard from './pages/user/Dashboard.jsx'
import Bus from './pages/user/Bus.jsx'
import BusStop from './pages/user/BusStop.jsx'
import Train from './pages/user/Train.jsx'
import TrainDetails from './pages/user/TrainDetails.jsx'
import PrivateTransport from './pages/user/PrivateTransport.jsx'
import RideTracking from './pages/user/RideTracking.jsx'
import PlanTrip from './pages/user/PlanTrip.jsx'
import Tracking from './pages/user/Tracking.jsx'
import VehicleDetails from './pages/user/VehicleDetails.jsx'
import Safety from './pages/user/Safety.jsx'

import DriverDashboard from './pages/driver/DriverDashboard.jsx'
import BusStartTrip from './pages/driver/BusStartTrip.jsx'
import BusLiveMap from './pages/driver/BusLiveMap.jsx'
import TrainService from './pages/driver/TrainService.jsx'
import DriverNavigation from './pages/driver/DriverNavigation.jsx'

import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminVehicles from './pages/admin/AdminVehicles.jsx'
import AdminDrivers from './pages/admin/AdminDrivers.jsx'
import AdminRoutes from './pages/admin/AdminRoutes.jsx'
import AdminTrains from './pages/admin/AdminTrains.jsx'
import AdminVerification from './pages/admin/AdminVerification.jsx'
import AdminGovernment from './pages/admin/AdminGovernment.jsx'
import AdminReports from './pages/admin/AdminReports.jsx'

import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      {/* Public landing + passenger app (same layout, navbar and footer as before) */}
      <Route path="/" element={<UserLayout />}>
        <Route index element={<Landing />} />
        <Route path="safety" element={<Safety />} />

        <Route path="dashboard" element={<RequireUser><Dashboard /></RequireUser>} />
        <Route path="bus" element={<RequireUser><Bus /></RequireUser>} />
        <Route path="bus-stop/:stopId" element={<RequireUser><BusStop /></RequireUser>} />
        <Route path="train" element={<RequireUser><Train /></RequireUser>} />
        <Route path="train/:id" element={<RequireUser><TrainDetails /></RequireUser>} />
        <Route path="private-transport" element={<RequireUser><PrivateTransport /></RequireUser>} />
        <Route path="ride/:id" element={<RequireUser><RideTracking /></RequireUser>} />
        <Route path="plan-trip" element={<RequireUser><PlanTrip /></RequireUser>} />
        <Route path="tracking" element={<RequireViewer><Tracking /></RequireViewer>} />
        <Route path="vehicle/:id" element={<RequireViewer><VehicleDetails /></RequireViewer>} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register-private" element={<RegisterPrivate />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/driver/login" element={<DriverLogin />} />

      {/* Driver / operator */}
      <Route path="/driver" element={<RequireDriver><DriverLayout /></RequireDriver>}>
        <Route index element={<DriverDashboard />} />
        <Route path="bus/start-trip" element={<BusStartTrip />} />
        <Route path="bus/live-map/:tripId" element={<BusLiveMap />} />
        <Route path="train/service/:id" element={<TrainService />} />
        <Route path="navigation/:rideId" element={<DriverNavigation />} />
      </Route>

      {/* Admin console */}
      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="vehicles" element={<AdminVehicles />} />
        <Route path="drivers" element={<AdminDrivers />} />
        <Route path="routes" element={<AdminRoutes />} />
        <Route path="trains" element={<AdminTrains />} />
        <Route path="verification" element={<AdminVerification />} />
        <Route path="government" element={<AdminGovernment />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
