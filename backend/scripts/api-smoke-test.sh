#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CTMS_BASE_URL:-http://localhost:8000}"
PASSWORD="${CTMS_SMOKE_PASSWORD:-password}"

mk_token() {
  local email="$1"
  curl -s -X POST "$BASE_URL/api/login" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}" \
  | php -r '$d=json_decode(stream_get_contents(STDIN),true); echo $d["access_token"] ?? "";'
}

request() {
  local role="$1"
  local method="$2"
  local endpoint="$3"
  local token="$4"

  local code
  code=$(curl -s -o /tmp/ctms_smoke_body.json -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" \
    -H "Authorization: Bearer $token" \
    -H 'Accept: application/json')

  local body_preview
  body_preview=$(head -c 100 /tmp/ctms_smoke_body.json | tr '\n' ' ')
  printf "%s | %-6s %-45s => %s | %s\n" "$role" "$method" "$endpoint" "$code" "$body_preview" >&2

  echo "$code"
}

assert_2xx() {
  local code="$1"
  local label="$2"
  if [[ ! "$code" =~ ^2 ]]; then
    echo "[FAIL] Expected 2xx for $label, got $code"
    return 1
  fi
}

assert_403_or_404() {
  local code="$1"
  local label="$2"
  if [[ "$code" != "403" && "$code" != "404" ]]; then
    echo "[FAIL] Expected 403/404 for $label, got $code"
    return 1
  fi
}

ADMIN_TOKEN=$(mk_token "admin@ctms.com")
DOSEN_TOKEN=$(mk_token "dosen1@ctms.com")
MAHASISWA_TOKEN=$(mk_token "student1@ctms.com")

if [[ -z "$ADMIN_TOKEN" || -z "$DOSEN_TOKEN" || -z "$MAHASISWA_TOKEN" ]]; then
  echo "[FAIL] Token generation failed. Check credentials and backend seed data."
  exit 1
fi

echo "=== Positive Role Checks ==="
code=$(request "admin" "GET" "/api/admin/dashboard" "$ADMIN_TOKEN"); assert_2xx "$code" "admin dashboard"
code=$(request "dosen" "GET" "/api/dosen/dashboard" "$DOSEN_TOKEN"); assert_2xx "$code" "dosen dashboard"
code=$(request "mahasiswa" "GET" "/api/mahasiswa/dashboard" "$MAHASISWA_TOKEN"); assert_2xx "$code" "mahasiswa dashboard"
code=$(request "admin" "GET" "/api/admin/finalization" "$ADMIN_TOKEN"); assert_2xx "$code" "admin finalization"
code=$(request "dosen" "GET" "/api/dosen/bids" "$DOSEN_TOKEN"); assert_2xx "$code" "dosen bids"
code=$(request "mahasiswa" "GET" "/api/mahasiswa/group" "$MAHASISWA_TOKEN"); assert_2xx "$code" "mahasiswa group"


echo "=== Shared Auth Checks ==="
code=$(request "admin" "GET" "/api/notifications/unread-count" "$ADMIN_TOKEN"); assert_2xx "$code" "admin notification count"
code=$(request "dosen" "GET" "/api/notifications/unread-count" "$DOSEN_TOKEN"); assert_2xx "$code" "dosen notification count"
code=$(request "mahasiswa" "GET" "/api/notifications/unread-count" "$MAHASISWA_TOKEN"); assert_2xx "$code" "mahasiswa notification count"


echo "=== Negative RBAC Checks ==="
code=$(request "mahasiswa" "GET" "/api/admin/dashboard" "$MAHASISWA_TOKEN"); assert_403_or_404 "$code" "mahasiswa->admin dashboard"
code=$(request "dosen" "GET" "/api/admin/dashboard" "$DOSEN_TOKEN"); assert_403_or_404 "$code" "dosen->admin dashboard"
code=$(request "admin" "GET" "/api/mahasiswa/group" "$ADMIN_TOKEN"); assert_403_or_404 "$code" "admin->mahasiswa group"
code=$(request "mahasiswa" "GET" "/api/dosen/bids" "$MAHASISWA_TOKEN"); assert_403_or_404 "$code" "mahasiswa->dosen bids"


echo "=== Logout Checks ==="
code=$(request "admin" "POST" "/api/logout" "$ADMIN_TOKEN"); assert_2xx "$code" "admin logout"
code=$(request "dosen" "POST" "/api/logout" "$DOSEN_TOKEN"); assert_2xx "$code" "dosen logout"
code=$(request "mahasiswa" "POST" "/api/logout" "$MAHASISWA_TOKEN"); assert_2xx "$code" "mahasiswa logout"

echo "[PASS] API smoke test completed successfully."
