#!/usr/bin/env bash
# optimize-models.sh
# Compresses all top-level .glb files in public/models/ using gltf-transform.
# Outputs to public/models/optimized/
# Prop models get --texture-resize 256; character/main models get --texture-resize 512.

set -euo pipefail

INPUT_DIR="$(dirname "$0")/../public/models"
OUTPUT_DIR="$(dirname "$0")/../public/models/optimized"

mkdir -p "$OUTPUT_DIR"

# Prop model name fragments that use 256px textures
PROP_PATTERNS=("Neon_Platfor" "Cyan_Ring" "Lego_bloks" "Neon_Quantu" "Sunny_Family" "32_Kg_Cast")

is_prop() {
  local filename="$1"
  for pattern in "${PROP_PATTERNS[@]}"; do
    if [[ "$filename" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

total_before=0
total_after=0

echo "================================================"
echo " GLB Optimization Pipeline"
echo " Input:  $INPUT_DIR"
echo " Output: $OUTPUT_DIR"
echo "================================================"
echo ""

for input_file in "$INPUT_DIR"/*.glb; do
  [ -f "$input_file" ] || continue

  filename="$(basename "$input_file")"
  output_file="$OUTPUT_DIR/$filename"

  size_before=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file")
  total_before=$((total_before + size_before))

  if is_prop "$filename"; then
    resize="256"
  else
    resize="512"
  fi

  echo "Processing: $filename  ($(( size_before / 1024 / 1024 ))MB, texture-resize ${resize})"

  # Try the combined optimize command first; fall back to separate steps on failure
  if gltf-transform optimize "$input_file" "$output_file" \
      --compress draco \
      --texture-compress webp \
      --texture-resize "$resize" 2>/dev/null; then
    echo "  [OK] gltf-transform optimize succeeded"
  else
    echo "  [WARN] Combined optimize failed — falling back to separate steps"
    tmp1="$OUTPUT_DIR/.tmp1_${filename}"
    tmp2="$OUTPUT_DIR/.tmp2_${filename}"

    ok=true

    if gltf-transform draco "$input_file" "$tmp1" 2>/dev/null; then
      echo "  [OK] draco step done"
    else
      echo "  [FAIL] draco step failed — skipping $filename"
      rm -f "$tmp1"
      ok=false
    fi

    if $ok && gltf-transform resize --width "$resize" --height "$resize" "$tmp1" "$tmp2" 2>/dev/null; then
      echo "  [OK] resize step done"
    elif $ok; then
      echo "  [WARN] resize step failed — continuing without resize"
      cp "$tmp1" "$tmp2"
    fi

    if $ok && gltf-transform webp "$tmp2" "$output_file" 2>/dev/null; then
      echo "  [OK] webp step done"
    elif $ok; then
      echo "  [WARN] webp step failed — using draco-only output"
      cp "$tmp2" "$output_file"
    fi

    rm -f "$tmp1" "$tmp2"
  fi

  if [ -f "$output_file" ]; then
    size_after=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file")
    total_after=$((total_after + size_after))
    pct=$(( (size_before - size_after) * 100 / size_before ))
    echo "  Before: $(( size_before / 1024 ))KB  →  After: $(( size_after / 1024 ))KB  (${pct}% reduction)"
  else
    echo "  [SKIP] No output produced for $filename"
  fi
  echo ""
done

echo "================================================"
echo " TOTAL BEFORE: $(( total_before / 1024 / 1024 ))MB"
echo " TOTAL AFTER:  $(( total_after  / 1024 / 1024 ))MB"
if [ "$total_before" -gt 0 ]; then
  total_pct=$(( (total_before - total_after) * 100 / total_before ))
  echo " OVERALL REDUCTION: ${total_pct}%"
fi
echo "================================================"
