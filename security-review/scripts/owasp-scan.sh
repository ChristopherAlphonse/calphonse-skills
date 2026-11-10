#!/usr/bin/env bash
# OWASP scan wrapper: static (source) and dynamic (running app) checks.
# Reports are triage input, not confirmed findings. See references/app-testing.md.
#
#   owasp-scan.sh static  <source-dir> [-o out-dir] [--dry-run]
#   owasp-scan.sh dynamic <url> --authorized [--active] [-m minutes] [-o out-dir] [--dry-run]
#
# Exit: 0 clean, 1 findings or warnings, 2 usage error, refused target, or tool error.
# Needs Docker for ZAP and Semgrep (a local semgrep binary is used if present).
set -u

ZAP_IMAGE="${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
SEMGREP_IMAGE="${SEMGREP_IMAGE:-semgrep/semgrep:latest}"
DRY_RUN=0

die() { printf 'owasp-scan: %s\n' "$*" >&2; exit 2; }

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

# Print the command under --dry-run, run it otherwise.
run() {
  if [ "$DRY_RUN" = 1 ]; then printf '+'; printf ' %q' "$@"; printf '\n'; return 0; fi
  "$@"
}

is_loopback() {
  case $1 in localhost|127.0.0.1|::1|*.localhost) return 0 ;; esac
  return 1
}

# Loopback is always allowed. Anything else must be listed by exact name.
host_allowed() {
  is_loopback "$1" && return 0
  local entry IFS=,
  for entry in ${OWASP_SCAN_ALLOWED_HOSTS:-}; do
    [ "$entry" = "$1" ] && return 0
  done
  return 1
}

# Prints the resolved output directory. An explicit -o dir must be new, in an existing parent.
make_out_dir() { # $1 label, $2 explicit dir or empty
  local dir=$2
  if [ -n "$dir" ]; then
    mkdir "$dir" 2>/dev/null || [ -d "$dir" ] || die "cannot create $dir (its parent must exist)"
  else
    dir="$HOME/security-review/scans/$1-$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -p "$dir" || die "cannot create $dir"
  fi
  (cd "$dir" && pwd -P)
}

scan_static() {
  local src=$1 out=$2 rc status=0
  src=$(cd "$src" 2>/dev/null && pwd -P) || die "source directory not found: $1"
  out=$(make_out_dir "$(basename "$src")" "$out") || exit 2
  case $out/ in "$src"/*) rmdir "$out" 2>/dev/null; die "output directory must be outside the source tree: $out" ;; esac

  echo "== Semgrep (p/owasp-top-ten) -> $out/semgrep.json"
  if command -v semgrep >/dev/null 2>&1; then
    run semgrep --config p/owasp-top-ten --metrics=off --error --json -o "$out/semgrep.json" "$src"
  else
    command -v docker >/dev/null 2>&1 || die "need semgrep or docker"
    run docker run --rm -v "$src:/src:ro" -v "$out:/out" "$SEMGREP_IMAGE" \
      semgrep --config p/owasp-top-ten --metrics=off --error --json -o /out/semgrep.json /src
  fi
  rc=$?
  [ "$DRY_RUN" = 1 ] && rc=0
  case $rc in
    0) [ "$DRY_RUN" = 1 ] && echo "   dry run: nothing executed" || echo "   no findings" ;;
    1) echo "   findings: $(grep -o '"check_id"' "$out/semgrep.json" 2>/dev/null | wc -l | tr -d ' ')"; status=1 ;;
    *) echo "   semgrep failed (exit $rc)" >&2; status=2 ;;
  esac

  echo "== Dependency audit"
  if [ -f "$src/package-lock.json" ] && command -v npm >/dev/null 2>&1; then
    echo "   npm audit -> $out/npm-audit.json"
    if [ "$DRY_RUN" = 1 ]; then
      echo "+ (cd $src && npm audit --package-lock-only --json > $out/npm-audit.json)"
    else
      (cd "$src" && npm audit --package-lock-only --json > "$out/npm-audit.json" 2>/dev/null)
      rc=$?
      if ! grep -q '"auditReportVersion"' "$out/npm-audit.json" 2>/dev/null; then
        echo "   npm audit failed (no report; offline?)" >&2; status=2
      elif [ $rc -ne 0 ]; then
        echo "   vulnerable dependencies reported"; [ $status -eq 0 ] && status=1
      else
        echo "   no vulnerable dependencies"
      fi
    fi
  elif [ -f "$src/requirements.txt" ] && command -v pip-audit >/dev/null 2>&1; then
    run pip-audit -r "$src/requirements.txt" -f json -o "$out/pip-audit.json"
    rc=$?
    case $rc in 0) echo "   no vulnerable dependencies" ;; 1) echo "   vulnerable dependencies reported"; [ $status -eq 0 ] && status=1 ;; *) status=2 ;; esac
  else
    echo "   skipped: no package-lock.json (with npm) or requirements.txt (with pip-audit)"
  fi
  echo "Reports in $out"
  return $status
}

scan_dynamic() {
  local url=$1 out=$2 authorized=$3 active=$4 mins=$5
  [ "$authorized" = 1 ] || die "dynamic scans need --authorized: confirm you own this target or have written permission to test it"

  local re_url='^https?://[^[:space:]]+$' re_auth='^[][A-Za-z0-9._:-]+$' re_port=':([0-9]+)$'
  [[ $url =~ $re_url ]] || die "target must be an http(s) URL without spaces"
  local scheme=${url%%://*} rest=${url#*://}
  local authority=${rest%%[/?#]*}
  local tail=${rest#"$authority"}
  # The strict character set rejects userinfo ('@') and backslash tricks that fool host parsing.
  [[ $authority =~ $re_auth ]] || die "unsupported characters in host part of URL (no credentials in URLs)"

  local port="" host=$authority
  if [[ $authority =~ $re_port ]]; then port=":${BASH_REMATCH[1]}"; host=${authority%"$port"}; fi
  case $host in \[*\]) host=${host#\[}; host=${host%\]} ;; esac
  host=$(printf '%s' "$host" | tr 'A-Z' 'a-z')
  [ -n "$host" ] || die "empty host"

  host_allowed "$host" || die "host '$host' is not allowed. Loopback is always allowed. For a dev or staging host you own, set OWASP_SCAN_ALLOWED_HOSTS=$host"

  local target=$url
  # Containers cannot reach the host's loopback, so point them at the Docker host alias.
  if is_loopback "$host"; then target="$scheme://host.docker.internal$port$tail"; fi

  out=$(make_out_dir "$host" "$out") || exit 2
  chmod 777 "$out" # the ZAP container user must be able to write reports here
  command -v docker >/dev/null 2>&1 || die "docker is required for ZAP"

  local script=zap-baseline.py
  if [ "$active" = 1 ]; then
    script=zap-full-scan.py
    echo "!! ACTIVE scan: sends attack payloads and can create or modify data. Use only on a disposable dev/staging copy."
  else
    echo "== ZAP baseline: spider + passive checks, no attacks"
  fi
  echo "   target: $target   reports: $out"

  run docker run --rm --add-host=host.docker.internal:host-gateway \
    -v "$out:/zap/wrk:rw" -t "$ZAP_IMAGE" \
    "$script" -t "$target" -m "$mins" -r report.html -w report.md -J report.json
  local rc=$?
  [ "$DRY_RUN" = 1 ] && { echo "   dry run: nothing executed"; return 0; }
  case $rc in
    0) echo "   no alerts" ; return 0 ;;
    1|2) echo "   alerts raised: review $out/report.html"; return 1 ;;
    *) echo "   ZAP failed (exit $rc)" >&2; return 2 ;;
  esac
}

main() {
  [ $# -ge 2 ] || usage
  local mode=$1 target=$2 out="" authorized=0 active=0 mins=1
  shift 2
  while [ $# -gt 0 ]; do
    case $1 in
      -o) [ $# -ge 2 ] || usage; out=$2; shift ;;
      -m) [ $# -ge 2 ] || usage; mins=$2; shift ;;
      --authorized) authorized=1 ;;
      --active) active=1 ;;
      --dry-run) DRY_RUN=1 ;;
      *) usage ;;
    esac
    shift
  done
  case $mins in ''|*[!0-9]*) die "-m must be a whole number of minutes" ;; esac

  case $mode in
    static) scan_static "$target" "$out" ;;
    dynamic) scan_dynamic "$target" "$out" "$authorized" "$active" "$mins" ;;
    *) usage ;;
  esac
}

main "$@"
