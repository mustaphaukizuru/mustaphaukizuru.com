#!/usr/bin/env bash
# =============================================================================
#  mustaphaukizuru.com · guard-duplicates.sh
#  CI-grade structural guard. Fails if any src/*/ directory contains a
#  subdirectory with the same name as its parent (i.e. src/foo/foo/).
#  Intended to run via `npm run lint:structure` in CI and pre-commit.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_BOLD=$'\033[1m'
else
  C_RESET=""; C_GREEN=""; C_RED=""; C_BOLD=""
fi

if [[ ! -d "src" ]]; then
  printf "${C_RED}✘ src/ directory not found at %s${C_RESET}\n" "${REPO_ROOT}" >&2
  exit 2
fi

violations=()

# Iterate every first-level subdirectory of src/ and check whether it
# contains a child with the same name. Only top-level src/*/*/ pairs are
# inspected — deeper paths are intentionally out of scope for this guard.
while IFS= read -r -d '' parent_dir; do
  parent_name="$(basename "${parent_dir}")"
  nested="${parent_dir}/${parent_name}"
  if [[ -d "${nested}" ]]; then
    violations+=("${nested}/")
  fi
done < <(find src -mindepth 1 -maxdepth 1 -type d -print0)

if (( ${#violations[@]} > 0 )); then
  printf "${C_BOLD}${C_RED}✘ Duplicate nested directories detected:${C_RESET}\n" >&2
  for v in "${violations[@]}"; do
    printf "  %s\n" "${v}" >&2
  done
  printf "\nRun ${C_BOLD}bash scripts/cleanup.sh${C_RESET} to remove them.\n" >&2
  exit 1
fi

printf "${C_GREEN}✔ No nested duplicate directories in src/${C_RESET}\n"
exit 0
