#!/usr/bin/env bash
set -euo pipefail

QUALITY="${1:-80}"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required but was not found in PATH."
  echo "Install it first (for example: brew install webp)."
  exit 1
fi

while IFS= read -r -d '' source_file; do
  output_file="${source_file%.*}.webp"
  cwebp -quiet -q "${QUALITY}" "${source_file}" -o "${output_file}"
done < <(
  find assets -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' \) ! -name 'favicon.ico' -print0
)

echo "WebP generation completed with quality=${QUALITY}."
