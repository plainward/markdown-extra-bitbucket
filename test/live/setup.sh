#!/usr/bin/env bash
# Boots a throwaway Bitbucket DC in Docker, installs the plugin and seeds test data.
# Used by .github/workflows/live-test.yml; also runnable locally.
#
# Env: BB_VERSION (e.g. 8.19.28), PLUGIN_JAR, BITBUCKET_LICENSE (timebomb key)
set -euo pipefail

BB_URL="${BB_URL:-http://localhost:7990}"
ADMIN="admin:admin"
PLUGIN_KEY="com.plainward.bitbucket.markdown-extra"
HERE="$(cd "$(dirname "$0")" && pwd)"

: "${BB_VERSION:?BB_VERSION is required}"
: "${PLUGIN_JAR:?PLUGIN_JAR is required}"
: "${BITBUCKET_LICENSE:?BITBUCKET_LICENSE is required (Bitbucket DC timebomb license)}"

echo "::group::Start Bitbucket $BB_VERSION"
docker run -d --name bitbucket -p 7990:7990 \
  -e SETUP_DISPLAYNAME="MarkdownX CI" \
  -e SETUP_BASEURL="$BB_URL" \
  -e SETUP_LICENSE="$BITBUCKET_LICENSE" \
  -e SETUP_SYSADMIN_USERNAME=admin \
  -e SETUP_SYSADMIN_PASSWORD=admin \
  -e SETUP_SYSADMIN_DISPLAYNAME="CI Admin" \
  -e SETUP_SYSADMIN_EMAILADDRESS=admin@example.com \
  -e SEARCH_ENABLED=false \
  -e JVM_MINIMUM_MEMORY=1g -e JVM_MAXIMUM_MEMORY=3g \
  -e JVM_SUPPORT_RECOMMENDED_ARGS="-Dupm.plugin.upload.enabled=true -Dfeature.auth.basic-auth.enabled=true" \
  "atlassian/bitbucket:$BB_VERSION"

for i in $(seq 1 120); do
  state=$(curl -s "$BB_URL/status" | sed -n 's/.*"state":"\([A-Z_]*\)".*/\1/p' || true)
  echo "[$i] status=${state:-none}"
  [ "$state" = "RUNNING" ] && break
  [ "$state" = "ERROR" ] && { docker logs bitbucket | tail -100; exit 1; }
  sleep 10
done
[ "$state" = "RUNNING" ] || { echo "Bitbucket did not start"; docker logs bitbucket | tail -200; exit 1; }
echo "::endgroup::"

echo "::group::Install plugin $(basename "$PLUGIN_JAR")"
TOKEN=$(curl -s -u "$ADMIN" -I "$BB_URL/rest/plugins/1.0/?os_authType=basic" | grep -i '^upm-token' | sed 's/.*: //' | tr -d '\r\n')
[ -n "$TOKEN" ] || { echo "No UPM token"; exit 1; }
curl -sf -u "$ADMIN" -F "plugin=@$PLUGIN_JAR" "$BB_URL/rest/plugins/1.0/?token=$TOKEN" >/dev/null

for i in $(seq 1 60); do
  info=$(curl -s -u "$ADMIN" "$BB_URL/rest/plugins/1.0/$PLUGIN_KEY-key" || true)
  if echo "$info" | grep -q '"enabled":true'; then break; fi
  sleep 5
done
echo "$info" > plugin-info.json
python3 - <<'PY'
import json, sys
info = json.load(open("plugin-info.json"))
if not info.get("enabled"):
    sys.exit("plugin is not enabled: " + json.dumps(info)[:2000])
disabled = [m["key"] for m in info.get("modules", []) if not m.get("enabled")]
if disabled:
    sys.exit("disabled modules: %s" % disabled)
print("plugin %s enabled, %d modules enabled" % (info.get("version"), len(info.get("modules", []))))
PY
echo "::endgroup::"

echo "::group::Seed users and repository"
# Non-admin user for permission checks
curl -sf -u "$ADMIN" -X POST -H 'X-Atlassian-Token: no-check' \
  "$BB_URL/rest/api/1.0/admin/users?name=alice&password=alice&displayName=Alice&emailAddress=alice@example.com&addToDefaultGroup=true"
curl -sf -u "$ADMIN" -X POST -H 'Content-Type: application/json' \
  -d '{"key":"TEST","name":"Test"}' "$BB_URL/rest/api/1.0/projects" >/dev/null
curl -sf -u "$ADMIN" -X PUT "$BB_URL/rest/api/1.0/projects/TEST/permissions/users?name=alice&permission=PROJECT_READ"
curl -sf -u "$ADMIN" -X POST -H 'Content-Type: application/json' \
  -d '{"name":"test-markdown","scmId":"git","defaultBranch":"main"}' \
  "$BB_URL/rest/api/1.0/projects/TEST/repos" >/dev/null

work=$(mktemp -d)
git -C "$work" init -q -b main
cp "$HERE/fixture/README.md" "$work/README.md"
git -C "$work" add README.md
git -C "$work" -c user.name=ci -c user.email=ci@example.com commit -qm "MarkdownX fixture"
git -C "$work" push -q "http://admin:admin@${BB_URL#http://}/scm/test/test-markdown.git" main
echo "::endgroup::"
