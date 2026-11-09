#!/bin/sh
# Downloads the OpenStreetMap data for the Algés - Cruz Quebrada stretch of
# the Marginal (EN6) into tools/osm/ (not committed: ~9 MB). Then run
#   node apps/marginal/tools/build_world.mjs
# Map data © OpenStreetMap contributors, ODbL.
set -e
cd "$(dirname "$0")"
mkdir -p osm
# bbox = west,south,east,north. The OSM API allows small areas only (< 50000 nodes).
curl -f -A "gizmo-marginal/0.1" -o osm/alges_cruz_quebrada.osm \
  "https://api.openstreetmap.org/api/0.6/map?bbox=-9.258,38.692,-9.224,38.706"
