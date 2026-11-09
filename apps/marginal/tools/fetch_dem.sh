#!/bin/sh
# Downloads the elevation data for the world's relief into tools/dem/ (not
# committed: ~6 MB): the SRTM 1 arc-second tile that holds the Marginal
# (N38W010: 38-39 N, 10-9 W), from the "Terrain Tiles" open data set on AWS.
# Then run
#   node apps/marginal/tools/build_world.mjs
# Elevation data: NASA SRTM (public domain).
set -e
cd "$(dirname "$0")"
mkdir -p dem
curl -f -A "gizmo-marginal/0.1" -o dem/N38W010.hgt.gz \
  "https://s3.amazonaws.com/elevation-tiles-prod/skadi/N38/N38W010.hgt.gz"
