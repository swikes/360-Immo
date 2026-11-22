#!/usr/bin/env bash
# Planches de contrôle d'une vidéo rendue : une image toutes les N images, numérotées, 6 × 3 par planche.
#   bash outils/motion/planches.sh sortie/brouillon.mp4 12   →   sortie/controle/planche_01.png…
set -euo pipefail
VIDEO="$1"; PAS="${2:-12}"
rm -rf sortie/controle && mkdir -p sortie/controle
ffmpeg -v error -i "$VIDEO" -vf "select='not(mod(n\,$PAS))',scale=270:480,drawtext=text='%{n}':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6" \
  -vsync vfr sortie/controle/f_%03d.png
ffmpeg -v error -i sortie/controle/f_%03d.png -vf "tile=6x3:color=black" sortie/controle/planche_%02d.png
ls sortie/controle/planche_*.png
