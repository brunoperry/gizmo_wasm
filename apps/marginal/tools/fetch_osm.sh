#!/bin/sh
# Downloads the OpenStreetMap data for the Algés - Paço de Arcos stretch of
# the Marginal (EN6) into tools/osm/ (not committed: ~19 MB), in three parts
# (the OSM API only gives small areas: < 50000 nodes). Then run
#   node apps/marginal/tools/build_world.mjs
# Map data © OpenStreetMap contributors, ODbL.
set -e
cd "$(dirname "$0")"
mkdir -p osm
get() { # name, bbox = west,south,east,north
  curl -f -A "gizmo-marginal/0.1" -o "osm/$1.osm" "https://api.openstreetmap.org/api/0.6/map?bbox=$2"
}
get alges_cruz_quebrada -9.258,38.692,-9.224,38.706
get caxias -9.279,38.686,-9.256,38.706
get paco_de_arcos -9.302,38.686,-9.278,38.706
