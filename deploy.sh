#!/bin/bash
# Deploy MarkdownX plugin to Bitbucket Data Center via UPM REST API.
#
# Usage: ./deploy.sh [BITBUCKET_URL] [USERNAME] [PASSWORD]
#   BITBUCKET_URL — base URL, default http://localhost:7990
#   USERNAME      — admin username, default admin
#   PASSWORD      — admin password, default admin
#
# Requires target/markdown-extra-*.jar (run `mvn package -DskipTests` first).

BITBUCKET_URL="${1:-http://localhost:7990}"
USERNAME="${2:-admin}"
PASSWORD="${3:-admin}"

PLUGIN_JAR=$(ls -t target/markdown-extra-*.jar 2>/dev/null | head -1)

if [ -z "$PLUGIN_JAR" ]; then
    echo "ERROR: No JAR found in target/. Run 'mvn package' first."
    exit 1
fi

echo "Deploying $PLUGIN_JAR to $BITBUCKET_URL..."

# Get UPM token
TOKEN=$(curl -s -u "$USERNAME:$PASSWORD" \
    "$BITBUCKET_URL/rest/plugins/1.0/?os_authType=basic" \
    -I 2>/dev/null | grep -i 'upm-token' | sed 's/.*: //' | tr -d '\r\n')

if [ -z "$TOKEN" ]; then
    echo "ERROR: Could not obtain UPM token. Check credentials."
    exit 1
fi

# Upload plugin
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -u "$USERNAME:$PASSWORD" \
    -F "plugin=@$PLUGIN_JAR" \
    "$BITBUCKET_URL/rest/plugins/1.0/?token=$TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "SUCCESS: Plugin deployed (HTTP $HTTP_CODE)"
else
    echo "FAILED: HTTP $HTTP_CODE"
    echo "$BODY"
    exit 1
fi
