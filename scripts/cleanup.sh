#!/usr/bin/env bash
# =============================================================================
#  mustaphaukizuru.com · cleanup.sh
#  Removes the five duplicate nested directories, the orphaned auth route,
#  and the backup mailer file — with a safety-net backup zip created first.
#
#  Idempotent: running it twice reports "nothing to remove" on the second run.
#  Safe: aborts if any live code still imports the orphaned auth route.
#  Canonical reference: 02-BACKEND-PROMPTS.md · B01
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Resolve the repository root (the parent of this script's directory)
# so the script works regardless of where it is invoked from.
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# -----------------------------------------------------------------------------
# Styling (falls back gracefully if terminal does not support colour)
# -----------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BLUE=""
fi

log()     { printf "%s\n" "$*"; }
ok()      { printf "  ${C_GREEN}✔${C_RESET} %s\n" "$*"; }
warn()    { printf "  ${C_YELLOW}•${C_RESET} %s\n" "$*"; }
fail()    { printf "  ${C_RED}✘${C_RESET} %s\n" "$*" >&2; }
section() { printf "\n${C_BOLD}${C_BLUE}%s${C_RESET}\n" "$*"; }

# -----------------------------------------------------------------------------
# Argument parsing — require confirmation unless --yes or CI=true
# -----------------------------------------------------------------------------
ASSUME_YES="${CI:-false}"
for arg in "$@"; do
  case "${arg}" in
    -y|--yes) ASSUME_YES="true" ;;
    -h|--help)
      cat <<USAGE
Usage: ${BASH_SOURCE[0]##*/} [--yes]

  Removes 5 duplicate nested directories + 2 orphan files from the
  mustaphaukizuru.com codebase, after backing them up to backups/.

  --yes, -y   Skip confirmation prompt (also triggered by CI=true).
  --help, -h  Show this message.
USAGE
      exit 0
      ;;
    *) fail "Unknown argument: ${arg}"; exit 2 ;;
  esac
done

# -----------------------------------------------------------------------------
# Target inventory — the single source of truth for what this script touches
# -----------------------------------------------------------------------------
NESTED_DIRS=(
  "src/controllers/controllers"
  "src/services/services"
  "src/routes/routes"
  "src/utils/utils"
  "src/middleware/middleware"
)

ORPHAN_FILES=(
  "src/routes/auth.js"
  "src/utils/mailer - Copy.js"
)

# -----------------------------------------------------------------------------
# Runtime guard: the task asserts that src/routes/index.js imports ./authRoutes
# (not ./auth). Before removing src/routes/auth.js, verify no live code still
# references it. Abort if a reference is found — safety over speed.
# -----------------------------------------------------------------------------
guard_auth_import() {
  section "Runtime guard · verifying src/routes/auth.js is truly orphaned"

  if [[ ! -f "src/routes/auth.js" ]]; then
    ok "src/routes/auth.js already removed — guard not required"
    return 0
  fi

  # Search src/ for require('./auth') or import … from './auth'
  # Exclude the orphan itself and any node_modules.
  local hits
  hits="$(grep -RInE \
    "(require\\(['\"]\\./auth['\"]\\)|from ['\"]\\./auth['\"])" \
    src \
    --exclude-dir=node_modules \
    --exclude="auth.js" \
    2>/dev/null || true)"

  if [[ -n "${hits}" ]]; then
    fail "Live code still imports ./auth — aborting to prevent breakage:"
    printf "%s\n" "${hits}" >&2
    exit 3
  fi

  ok "No live imports of ./auth found — safe to remove src/routes/auth.js"
}

# -----------------------------------------------------------------------------
# Build the list of items that actually exist right now.
# This is what makes the script idempotent: on a second run, the lists below
# are empty and the script reports "nothing to do" cleanly.
# -----------------------------------------------------------------------------
collect_targets() {
  DIRS_TO_REMOVE=()
  FILES_TO_REMOVE=()

  for d in "${NESTED_DIRS[@]}"; do
    [[ -d "${d}" ]] && DIRS_TO_REMOVE+=("${d}")
  done
  for f in "${ORPHAN_FILES[@]}"; do
    [[ -e "${f}" ]] && FILES_TO_REMOVE+=("${f}")
  done
}

# -----------------------------------------------------------------------------
# Report planned actions
# -----------------------------------------------------------------------------
report_plan() {
  section "Planned actions"

  if (( ${#DIRS_TO_REMOVE[@]} == 0 )) && (( ${#FILES_TO_REMOVE[@]} == 0 )); then
    ok "Nothing to remove — codebase is already clean"
    return 1
  fi

  if (( ${#DIRS_TO_REMOVE[@]} > 0 )); then
    log "${C_BOLD}Directories to remove:${C_RESET}"
    for d in "${DIRS_TO_REMOVE[@]}"; do warn "${d}/"; done
  fi

  if (( ${#FILES_TO_REMOVE[@]} > 0 )); then
    log "${C_BOLD}Files to remove:${C_RESET}"
    for f in "${FILES_TO_REMOVE[@]}"; do warn "${f}"; done
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Confirmation prompt (bypassable via --yes or CI=true)
# -----------------------------------------------------------------------------
confirm() {
  if [[ "${ASSUME_YES}" == "true" ]]; then return 0; fi
  printf "\n${C_BOLD}Proceed with backup + removal? [y/N] ${C_RESET}"
  read -r REPLY
  [[ "${REPLY}" =~ ^[Yy]$ ]]
}

# -----------------------------------------------------------------------------
# Create a timestamped backup containing every item about to be deleted.
# Uses `zip` when available; falls back to `tar -czf` with a .tar.gz extension.
# -----------------------------------------------------------------------------
make_backup() {
  section "Creating backup"

  mkdir -p backups
  local stamp; stamp="$(date +%Y%m%d-%H%M%S)"

  local items=()
  items+=("${DIRS_TO_REMOVE[@]}")
  items+=("${FILES_TO_REMOVE[@]}")

  if command -v zip >/dev/null 2>&1; then
    local dest="backups/pre-cleanup-${stamp}.zip"
    # -q quiet · -r recursive · preserves paths relative to REPO_ROOT
    zip -qr "${dest}" "${items[@]}"
    ok "Backup written: ${dest}"
    BACKUP_PATH="${dest}"
  else
    local dest="backups/pre-cleanup-${stamp}.tar.gz"
    warn "'zip' not available — falling back to tar.gz"
    tar -czf "${dest}" "${items[@]}"
    ok "Backup written: ${dest}"
    BACKUP_PATH="${dest}"
  fi
}

# -----------------------------------------------------------------------------
# Remove targets. `rm -rf` is safe here: every path is rooted at REPO_ROOT
# and bounded by our allow-list arrays; the script never consumes untrusted
# input as a path.
# -----------------------------------------------------------------------------
remove_targets() {
  section "Removing targets"

  for d in "${DIRS_TO_REMOVE[@]}"; do
    rm -rf -- "${d}"
    ok "Removed directory: ${d}/"
  done
  for f in "${FILES_TO_REMOVE[@]}"; do
    rm -f -- "${f}"
    ok "Removed file: ${f}"
  done
}

# -----------------------------------------------------------------------------
# Final report
# -----------------------------------------------------------------------------
report_final() {
  section "Cleanup complete"
  ok "Backup preserved at: ${BACKUP_PATH}"
  log ""
  log "${C_BOLD}Preserved (canonical files):${C_RESET}"
  warn "src/routes/authRoutes.js"
  warn "src/utils/mailer.js"
  warn "src/controllers/*.js  (root level)"
  warn "src/services/*.js     (root level)"
  warn "src/routes/*.js       (root level)"
  warn "src/utils/*.js        (root level)"
  warn "src/middleware/*.js   (root level)"
  log ""
  log "${C_BOLD}Next steps:${C_RESET}"
  log "  1. npm start                            # server boots on PORT"
  log "  2. curl http://localhost:5000/api/health    # expect 200"
  log "  3. curl http://localhost:5000/api/products  # expect 200"
  log "  4. npm run lint:structure               # verify no duplicates"
  log ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  section "mustaphaukizuru.com · B01 cleanup"
  log "Repository root: ${REPO_ROOT}"

  guard_auth_import
  collect_targets
  report_plan || { log ""; exit 0; }
  confirm || { log ""; warn "Aborted by user — no changes made"; exit 0; }
  make_backup
  remove_targets
  report_final
}

main "$@"
