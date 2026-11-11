-- YatraOne schema (MySQL 8+). Run:  CREATE DATABASE yatraone;  then import this file, then seed.sql
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  mobile VARCHAR(15) NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('USER','DRIVER','ADMIN') NOT NULL DEFAULT 'USER',
  city VARCHAR(80) NULL,
  state VARCHAR(80) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS depots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  operator VARCHAR(60) NOT NULL DEFAULT 'BEST',
  city VARCHAR(80) NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Generic stops (bus stops + railway stations live in their own tables, `stops` is the shared registry used by routes)
CREATE TABLE IF NOT EXISTS stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  kind ENUM('BUS','TRAIN','OTHER') NOT NULL DEFAULT 'BUS',
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  external_code VARCHAR(40) NULL,
  INDEX idx_stops_geo (latitude, longitude),
  INDEX idx_stops_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  transport ENUM('BUS','TRAIN') NOT NULL DEFAULT 'BUS',
  origin VARCHAR(120) NOT NULL,
  destination VARCHAR(120) NOT NULL,
  fare VARCHAR(20) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  driver_type ENUM('GOV_BUS','TRAIN_OPERATOR','TAXI','AUTO') NOT NULL,
  licence_number VARCHAR(40) NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  verification_status ENUM('PENDING','APPROVED','REJECTED','REUPLOAD','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  is_online TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_number VARCHAR(30) NOT NULL UNIQUE,
  transport ENUM('BUS','TRAIN','TAXI','AUTO') NOT NULL,
  ownership ENUM('GOVERNMENT','PRIVATE') NOT NULL,
  operator VARCHAR(60) NULL,
  model VARCHAR(80) NULL,
  plate_type ENUM('YELLOW','WHITE','GOVT') NOT NULL DEFAULT 'YELLOW',
  driver_id INT NULL,
  depot_id INT NULL,
  route_id INT NULL,
  gps_device_id VARCHAR(60) NULL,
  status ENUM('ACTIVE','SUSPENDED','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  verification_status ENUM('PENDING','APPROVED','REJECTED','REUPLOAD','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  is_test_data TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (depot_id) REFERENCES depots(id) ON DELETE SET NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  INDEX idx_veh_transport (transport, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  route_id INT NOT NULL,
  direction ENUM('UP','DOWN') NOT NULL DEFAULT 'UP',
  scheduled_start TIME NULL,
  UNIQUE KEY uq_vr (vehicle_id, route_id, direction),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  driver_id INT NULL,
  transport ENUM('BUS','TRAIN') NOT NULL,
  status ENUM('ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  data_source ENUM('LIVE','TEST') NOT NULL DEFAULT 'LIVE',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  INDEX idx_trips_active (status, transport)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  trip_id INT NULL,
  ride_id INT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_m DECIMAL(8,2) NULL,
  speed_kmh DECIMAL(6,2) NULL,
  heading DECIMAL(6,2) NULL,
  data_source ENUM('LIVE','TEST') NOT NULL DEFAULT 'LIVE',
  recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  INDEX idx_ll_vehicle_time (vehicle_id, recorded_at),
  INDEX idx_ll_trip (trip_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS verification_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NULL,
  vehicle_id INT NULL,
  doc_type ENUM('LICENCE','RC','DRIVER_PHOTO','VEHICLE_PHOTO','PLATE') NOT NULL,
  original_name VARCHAR(200) NOT NULL,
  stored_name VARCHAR(120) NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  size_bytes INT NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED','REUPLOAD') NOT NULL DEFAULT 'PENDING',
  admin_note VARCHAR(255) NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  title VARCHAR(200) NOT NULL,
  body VARCHAR(400) NULL,
  type ENUM('live','warn','success','neutral') NOT NULL DEFAULT 'neutral',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(80) NOT NULL,
  from_text VARCHAR(140) NOT NULL,
  to_text VARCHAR(140) NOT NULL,
  mode ENUM('BUS','TRAIN','TAXI','AUTO','MIXED') NOT NULL DEFAULT 'MIXED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  vehicle_id INT NULL,
  reason VARCHAR(80) NOT NULL,
  details VARCHAR(500) NULL,
  status ENUM('OPEN','REVIEWING','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  vehicle_id INT NULL,
  transport ENUM('BUS','TRAIN','TAXI','AUTO') NOT NULL,
  from_text VARCHAR(140) NOT NULL,
  to_text VARCHAR(140) NOT NULL,
  status ENUM('PLANNED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'COMPLETED',
  duration_min INT NULL,
  fare VARCHAR(20) NULL,
  trip_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- BUS ----------------
CREATE TABLE IF NOT EXISTS bus_stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  stop_code VARCHAR(30) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_bs_geo (latitude, longitude),
  INDEX idx_bs_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bus_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NULL,
  route_number VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  origin VARCHAR(120) NOT NULL,
  destination VARCHAR(120) NOT NULL,
  depot_id INT NULL,
  fare VARCHAR(20) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  FOREIGN KEY (depot_id) REFERENCES depots(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bus_route_stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_route_id INT NOT NULL,
  bus_stop_id INT NOT NULL,
  seq INT NOT NULL,
  UNIQUE KEY uq_brs (bus_route_id, seq),
  FOREIGN KEY (bus_route_id) REFERENCES bus_routes(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_stop_id) REFERENCES bus_stops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bus_trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL UNIQUE,
  bus_route_id INT NOT NULL,
  direction ENUM('UP','DOWN') NOT NULL DEFAULT 'UP',
  current_seq INT NOT NULL DEFAULT 0,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_route_id) REFERENCES bus_routes(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bus_trip_stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_trip_id INT NOT NULL,
  bus_stop_id INT NOT NULL,
  seq INT NOT NULL,
  status ENUM('UPCOMING','NEXT','ARRIVED','DEPARTED') NOT NULL DEFAULT 'UPCOMING',
  arrived_at DATETIME NULL,
  UNIQUE KEY uq_bts (bus_trip_id, seq),
  FOREIGN KEY (bus_trip_id) REFERENCES bus_trips(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_stop_id) REFERENCES bus_stops(id)
) ENGINE=InnoDB;

-- ---------------- TRAIN ----------------
CREATE TABLE IF NOT EXISTS railway_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  zone VARCHAR(60) NULL,
  color VARCHAR(9) NOT NULL DEFAULT '#7089FF',
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS railway_stations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  station_code VARCHAR(10) NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_rs_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS train_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_id INT NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  service_type ENUM('SLOW','FAST','AC') NOT NULL DEFAULT 'SLOW',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (line_id) REFERENCES railway_lines(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS train_route_stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  train_route_id INT NOT NULL,
  station_id INT NOT NULL,
  seq INT NOT NULL,
  offset_min INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_trs (train_route_id, seq),
  FOREIGN KEY (train_route_id) REFERENCES train_routes(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES railway_stations(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS train_trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NULL,
  train_route_id INT NOT NULL,
  train_number VARCHAR(20) NOT NULL,
  vehicle_id INT NULL,
  scheduled_departure TIME NOT NULL,
  platform VARCHAR(6) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  FOREIGN KEY (train_route_id) REFERENCES train_routes(id),
  INDEX idx_tt_route (train_route_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS train_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  train_trip_id INT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_m DECIMAL(8,2) NULL,
  speed_kmh DECIMAL(6,2) NULL,
  heading DECIMAL(6,2) NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'OPERATOR',
  recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (train_trip_id) REFERENCES train_trips(id) ON DELETE CASCADE,
  INDEX idx_tl (train_trip_id, recorded_at)
) ENGINE=InnoDB;

-- ---------------- PRIVATE RIDES ----------------
CREATE TABLE IF NOT EXISTS rides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  passenger_id INT NOT NULL,
  driver_id INT NULL,
  vehicle_id INT NULL,
  transport ENUM('TAXI','AUTO') NOT NULL DEFAULT 'TAXI',
  pickup_text VARCHAR(160) NOT NULL,
  pickup_lat DECIMAL(10,7) NOT NULL,
  pickup_lng DECIMAL(10,7) NOT NULL,
  dest_text VARCHAR(160) NOT NULL,
  dest_lat DECIMAL(10,7) NOT NULL,
  dest_lng DECIMAL(10,7) NOT NULL,
  status ENUM('REQUESTED','ACCEPTED','ARRIVING','ARRIVED','STARTED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  data_source ENUM('LIVE','TEST') NOT NULL DEFAULT 'LIVE',
  cancelled_by ENUM('PASSENGER','DRIVER','ADMIN') NULL,
  distance_km DECIMAL(7,2) NULL,
  fare_estimate VARCHAR(20) NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME NULL,
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  FOREIGN KEY (passenger_id) REFERENCES users(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  INDEX idx_rides_status (status),
  INDEX idx_rides_passenger (passenger_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ride_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ride_id INT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_m DECIMAL(8,2) NULL,
  speed_kmh DECIMAL(6,2) NULL,
  heading DECIMAL(6,2) NULL,
  recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
  INDEX idx_rl (ride_id, recorded_at)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
