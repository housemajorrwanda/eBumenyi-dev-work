#!/usr/bin/env bash
# Test chunked video upload (same flow as course builder).
# Usage:
#   export TOKEN="your-jwt"
#   export VIDEO="/path/to/large-video.mp4"
#   ./scripts/test-chunked-video-upload.sh
#
# Optional:
#   BASE_URL=https://apitest.ebumenyi.online/api   (default — through Traefik/socat)
#   BASE_URL=http://10.10.119.36:9000/api          (direct to API, bypasses proxy)
#   CHUNK_SIZE=1048576                             (1MB, default)
#   UPLOAD_ID=uuid                                 (resume a failed upload)

set -euo pipefail

BASE_URL="${BASE_URL:-https://apitest.ebumenyi.online/api}"
HEALTH_URL="${BASE_URL%/api}/health"
CHUNK_SIZE="${CHUNK_SIZE:-1048576}" # 1MB
MAX_RETRIES="${MAX_RETRIES:-5}"

: "${TOKEN:?Set TOKEN (JWT)}"
: "${VIDEO:?Set VIDEO (path to .mp4 file)}"

if [[ ! -f "$VIDEO" ]]; then
  echo "ERROR: file not found: $VIDEO" >&2
  exit 1
fi

FILE_NAME=$(basename "$VIDEO")
FILE_SIZE=$(stat -c%s "$VIDEO")
TOTAL_CHUNKS=$(( (FILE_SIZE + CHUNK_SIZE - 1) / CHUNK_SIZE ))
UPLOAD_ID="${UPLOAD_ID:-$(uuidgen)}"
START_CHUNK="${START_CHUNK:-0}"

echo "=== Health check ==="
curl -sS -o /dev/null -w "GET $HEALTH_URL → HTTP %{http_code}\n" "$HEALTH_URL"

echo ""
echo "=== Chunked upload ==="
echo "Base URL:  $BASE_URL"
echo "File:      $VIDEO"
echo "Size:      $FILE_SIZE bytes ($(numfmt --to=iec-i --suffix=B "$FILE_SIZE" 2>/dev/null || echo "$FILE_SIZE"))"
echo "Chunks:    $TOTAL_CHUNKS × ${CHUNK_SIZE} bytes (starting at chunk $START_CHUNK)"
echo "Upload ID: $UPLOAD_ID"
echo ""

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

split -b "$CHUNK_SIZE" -d "$VIDEO" "$TMPDIR/part-"

upload_chunk() {
  local idx="$1"
  local part="$2"
  local attempt http

  for attempt in $(seq 1 "$MAX_RETRIES"); do
    http=$(curl -sS -o "$TMPDIR/resp-$idx.json" -w "%{http_code}" \
      --http1.1 --no-keepalive \
      -H "Connection: close" \
      -X POST "$BASE_URL/upload/video/chunk" \
      -H "Authorization: $TOKEN" \
      -F "uploadId=$UPLOAD_ID" \
      -F "chunkIndex=$idx" \
      -F "totalChunks=$TOTAL_CHUNKS" \
      -F "fileName=$FILE_NAME" \
      -F "chunk=@${part};type=application/octet-stream" \
      --max-time 120)

    if [[ "$http" == "200" ]]; then
      echo "HTTP $http"
      return 0
    fi

    if [[ "$attempt" -lt "$MAX_RETRIES" ]] && [[ "$http" =~ ^(408|502|503|504)$ ]]; then
      echo -n "HTTP $http (retry $attempt/$MAX_RETRIES) ... "
      sleep $((attempt * 2))
      continue
    fi

    echo "HTTP $http"
    cat "$TMPDIR/resp-$idx.json" 2>/dev/null || true
    echo ""
    return 1
  done
}

i=0
for part in "$TMPDIR"/part-*; do
  if [[ "$i" -lt "$START_CHUNK" ]]; then
    i=$((i + 1))
    continue
  fi
  echo -n "Uploading chunk $i/$((TOTAL_CHUNKS - 1)) ... "
  upload_chunk "$i" "$part" || exit 1
  sleep 0.15
  i=$((i + 1))
done

echo ""
echo "=== Complete upload ==="
HTTP=$(curl -sS -o "$TMPDIR/complete.json" -w "%{http_code}" \
  --http1.1 --no-keepalive \
  -H "Connection: close" \
  -X POST "$BASE_URL/upload/video/complete" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"uploadId\":\"$UPLOAD_ID\",\"totalChunks\":$TOTAL_CHUNKS,\"fileName\":\"$FILE_NAME\"}" \
  --max-time 120)

echo "HTTP $HTTP"
cat "$TMPDIR/complete.json"
echo ""

if [[ "$HTTP" == "200" ]]; then
  echo "SUCCESS — video URL in response above"
else
  echo "To resume from last good chunk, re-run with:"
  echo "  UPLOAD_ID=$UPLOAD_ID START_CHUNK=<next-index> ./scripts/test-chunked-video-upload.sh"
  exit 1
fi
