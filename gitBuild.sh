#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

if (( $# > 1 )); then
  echo "Usage: $0 [version]" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Cannot build: the worktree has uncommitted changes." >&2
  exit 1
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "master" ]]; then
  echo "Cannot build from branch '$branch'; gitBuild.sh only supports 'master'." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Cannot build: GitHub CLI ('gh') is required to dispatch CI." >&2
  exit 1
fi
if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo "Cannot build: GitHub CLI is not authenticated for github.com. Run 'gh auth login' first." >&2
  exit 1
fi

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)" || {
  echo "Cannot build: branch '$branch' has no configured upstream." >&2
  exit 1
}
remote="$(git config --get "branch.$branch.remote" || true)"
if [[ -z "$remote" || "$remote" == "." ]]; then
  echo "Cannot build: branch '$branch' does not track a remote branch." >&2
  exit 1
fi
if [[ "$upstream" != "$remote/$branch" ]]; then
  echo "Cannot build: local '$branch' must track '$remote/$branch', not '$upstream'." >&2
  exit 1
fi

git fetch --quiet "$remote"
read -r behind ahead < <(git rev-list --left-right --count "$upstream...HEAD")
if (( ahead > 0 )); then
  echo "Cannot build: branch '$branch' has $ahead un-pushed commit(s)." >&2
  exit 1
fi
if (( behind > 0 )); then
  echo "Cannot build: branch '$branch' is $behind commit(s) behind '$upstream'." >&2
  exit 1
fi

current_version="$(node -e 'process.stdout.write(require(process.argv[1]).version)' "$repo_root/package.json")"
lock_version="$(node -e 'process.stdout.write(require(process.argv[1]).version)' "$repo_root/package-lock.json")"
if [[ "$current_version" != "$lock_version" ]]; then
  echo "Cannot build: package.json version '$current_version' does not match package-lock.json version '$lock_version'." >&2
  exit 1
fi

release_version="$current_version"
if (( $# == 1 )); then
  requested_version="$1"
  release_version="$requested_version"
  node - "$current_version" "$requested_version" <<'NODE'
const [current, requested] = process.argv.slice(2);
const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parse(value) {
  const match = pattern.exec(value);
  return match && {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4] === undefined ? null : match[4].split('.'),
  };
}

function compare(left, right) {
  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) return Math.sign(left.core[index] - right.core[index]);
  }
  if (left.prerelease === null || right.prerelease === null) {
    return left.prerelease === right.prerelease ? 0 : left.prerelease === null ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Math.sign(Number(leftPart) - Number(rightPart));
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

const parsedCurrent = parse(current);
const parsedRequested = parse(requested);
if (!parsedCurrent) {
  console.error(`package.json contains invalid SemVer '${current}'`);
  process.exit(1);
}
if (!parsedRequested) {
  console.error(`Invalid version '${requested}'; expected SemVer (for example 38.0.1)`);
  process.exit(1);
}
if (compare(parsedRequested, parsedCurrent) < 0) {
  console.error(`Version '${requested}' is older than current version '${current}'`);
  process.exit(1);
}
NODE
fi

package_name="$(node -e 'process.stdout.write(require(process.argv[1]).name)' "$repo_root/package.json")"
echo "Checking ${package_name}@${release_version} against published npm versions..."
npm view "$package_name" versions --json --registry=https://registry.npmjs.org \
  | node .github/scripts/assert-version-newer.cjs "$release_version"

if (( $# == 1 )); then
  node - "$repo_root/package.json" "$repo_root/package-lock.json" "$requested_version" <<'NODE'
const fs = require('node:fs');
const [manifestPath, lockPath, version] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
manifest.version = version;
lock.version = version;
lock.packages[''].version = version;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
NODE

  git add -- package.json package-lock.json
  git commit --allow-empty -m "build v${requested_version}" -- package.json package-lock.json
  git push "$remote" "$branch"
  current_version="$requested_version"
fi

tag="v${current_version}"
head_sha="$(git rev-parse HEAD)"

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  tag_sha="$(git rev-parse "refs/tags/${tag}^{commit}")"
  if [[ "$tag_sha" != "$head_sha" ]]; then
    echo "Cannot build: local tag '$tag' points to $tag_sha, not current HEAD $head_sha." >&2
    exit 1
  fi
else
  git tag -a "$tag" -m "build $tag"
fi

remote_tag_sha="$(git ls-remote "$remote" "refs/tags/$tag^{}" | awk '{print $1}')"
if [[ -z "$remote_tag_sha" ]]; then
  remote_tag_sha="$(git ls-remote "$remote" "refs/tags/$tag" | awk '{print $1}')"
fi
if [[ -n "$remote_tag_sha" && "$remote_tag_sha" != "$head_sha" ]]; then
  echo "Cannot build: remote tag '$tag' points to $remote_tag_sha, not current HEAD $head_sha." >&2
  exit 1
fi
if [[ -z "$remote_tag_sha" ]]; then
  git push "$remote" "$tag"
fi

echo "Dispatching robotjs_jm CI from workflow branch '$branch' for source tag '$tag'..."
gh workflow run ci.yml \
  --ref "$branch" \
  --raw-field "ref=$tag"
