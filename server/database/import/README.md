# Importing real data
Use only data you are authorised to use (open-data portals, operator-provided feeds, your own surveys).
Formats: CSV (header row), JSON array, GeoJSON FeatureCollection of Points.

    cd server
    node src/utils/importer.js bus-stops database/import/samples/bus-stops.csv
    node src/utils/importer.js depots <file>
    node src/utils/importer.js railway-stations database/import/samples/railway-stations.geojson
    node src/utils/importer.js bus-routes database/import/samples/bus-routes.json
    node src/utils/importer.js train-routes <routes.json>

Duplicates (same name within 80 m) are skipped. Route imports resolve stops/stations by name or code and report problems per route.
`seed.sql` itself is DEVELOPMENT DATA with approximate coordinates and a placeholder timetable.
