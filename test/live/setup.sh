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
# Atlassian's public "Developer Test License" for Bitbucket DC (valid 3 hours from
# server start), published for app testing at
# https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/
# Set BITBUCKET_LICENSE to override it.
if [ -z "${BITBUCKET_LICENSE:-}" ]; then
  BITBUCKET_LICENSE="$(tr -d '[:space:]' < "$HERE/bitbucket-dc-timebomb.license")"
fi

echo "::group::Start Bitbucket $BB_VERSION"
# Bitbucket 10 blocks basic auth by default; atlassian-authentication-plugin reads
# ...basic.auth.filter.force.allow via Boolean.getBoolean to let it through.
# Bitbucket 10's UPM also rejects unsigned apps ("Signature check failed!");
# Marketplace builds are signed by Atlassian, CI builds are not.
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
  -e JVM_SUPPORT_RECOMMENDED_ARGS="-Dupm.plugin.upload.enabled=true -Dfeature.auth.basic-auth.enabled=true -Dcom.atlassian.plugins.authentication.basic.auth.filter.force.allow=true -Datlassian.upm.signature.check.disabled=true" \
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

if curl -s -u "$ADMIN" "$BB_URL/rest/api/1.0/users/admin" | grep -q "Basic Authentication has been disabled"; then
  echo "::error::Basic auth is blocked on Bitbucket $BB_VERSION despite force.allow"
  exit 1
fi

echo "::group::Install plugin $(basename "$PLUGIN_JAR")"
# UPM can come up after /status reports RUNNING, so retry. Use GET, not HEAD.
TOKEN=""
for i in $(seq 1 30); do
  TOKEN=$(curl -s -u "$ADMIN" -D - -o /dev/null "$BB_URL/rest/plugins/1.0/?os_authType=basic" \
    | grep -i '^upm-token' | sed 's/.*: //' | tr -d '\r\n' || true)
  [ -n "$TOKEN" ] && break
  echo "[$i] waiting for UPM token"
  sleep 10
done
if [ -z "$TOKEN" ]; then
  echo "::error::No UPM token from $BB_URL/rest/plugins/1.0/"
  curl -s -u "$ADMIN" -i "$BB_URL/rest/plugins/1.0/?os_authType=basic" | head -40 || true
  docker logs bitbucket 2>&1 | tail -80
  exit 1
fi
upload=$(curl -s -u "$ADMIN" -w '\n%{http_code}' -F "plugin=@$PLUGIN_JAR" "$BB_URL/rest/plugins/1.0/?token=$TOKEN")
code=$(echo "$upload" | tail -1)
if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
  echo "::error::UPM upload failed with HTTP $code"
  echo "$upload" | head -40
  exit 1
fi

# The upload only queues an install task; wait for it and surface its error.
task=$(echo "$upload" | grep -o '/rest/plugins/1.0/pending/[^"]*' | head -1 || true)
if [ -n "$task" ]; then
  for i in $(seq 1 60); do
    status=$(curl -s -u "$ADMIN" "$BB_URL$task" || true)
    echo "$status" | grep -q '"done":true' && break
    sleep 3
  done
  if echo "$status" | grep -q 'install.err'; then
    echo "::error::UPM could not install the plugin"
    echo "$status"
    docker exec bitbucket grep -i -E 'upm|markdown-extra|plainward' \
      /var/atlassian/application-data/bitbucket/log/atlassian-bitbucket.log | tail -40 || true
    exit 1
  fi
fi

for i in $(seq 1 60); do
  info=$(curl -s -u "$ADMIN" "$BB_URL/rest/plugins/1.0/$PLUGIN_KEY-key" || true)
  if echo "$info" | grep -q '"enabled":true'; then break; fi
  sleep 5
done
echo "$info" > plugin-info.json
if ! python3 - <<'PY'
import json, sys
raw = open("plugin-info.json").read()
try:
    info = json.loads(raw)
except ValueError:
    sys.exit("UPM plugin info is not JSON:\n" + raw[:3000])
if not info.get("enabled"):
    sys.exit("plugin is not enabled: " + json.dumps(info)[:2000])
disabled = [m["key"] for m in info.get("modules", []) if not m.get("enabled")]
if disabled:
    sys.exit("disabled modules: %s" % disabled)
print("plugin %s enabled, %d modules enabled" % (info.get("version"), len(info.get("modules", []))))
PY
then
  echo "--- plugin lines from atlassian-bitbucket.log ---"
  docker exec bitbucket grep -i -E 'markdown-extra|markdownx|plainward' \
    /var/atlassian/application-data/bitbucket/log/atlassian-bitbucket.log | tail -60 || true
  exit 1
fi
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
