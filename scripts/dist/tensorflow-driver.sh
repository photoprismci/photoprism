#!/usr/bin/env bash

CPU_DETECTED=$(lshw -c processor -json 2>/dev/null)

if [[ $(echo "${CPU_DETECTED}" | jq -r '.[].capabilities.avx2') == "true" ]]; then
  echo "avx2"
elif [[ $(echo "${CPU_DETECTED}" | jq -r '.[].capabilities.avx') == "true" ]]; then
  echo "avx"
fi