#!/bin/bash
# Deploy MarkdownX plugin to Bitbucket 8.19 DC (Docker) via UPM REST API
#
# Usage: ./deploy-plugin-8x.sh [USERNAME] [PASSWORD]
#
# Expects JAR in ../target/

BITBUCKET_URL="http://localhost:7993"
USERNAME="${1:-admin}"
PASSWORD="${2:-admin}"

PLUGIN_JAR=$(ls -t ../target/markdown-extra-*.jar 2>/dev/null | head -1)

if [ -z "$PLUGIN_JAR" ]; then
    echo "ERROR: No JAR found in ../target/. Run 'mvn package' first."
    exit 1
fi

echo "Deploying $PLUGIN_JAR to $BITBUCKET_URL (Bitbucket 8.19)..."

# Get UPM token
TOKEN=$(curl -s -u "$USERNAME:$PASSWORD" \
    "$BITBUCKET_URL/rest/plugins/1.0/?os_authType=basic" \
    -I 2>/dev/null | grep -i 'upm-token' | sed 's/.*: //' | tr -d '\r\n')

if [ -z "$TOKEN" ]; then
    echo "ERROR: Could not obtain UPM token. Is Bitbucket running? Check credentials."
    echo "  URL: $BITBUCKET_URL"
    echo "  User: $USERNAME"
    exit 1
fi

echo "UPM token obtained. Uploading..."

# Upload plugin
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -u "$USERNAME:$PASSWORD" \
    -F "plugin=@$PLUGIN_JAR" \
    "$BITBUCKET_URL/rest/plugins/1.0/?token=$TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "SUCCESS: Plugin deployed (HTTP $HTTP_CODE)"
    echo "  Open: $BITBUCKET_URL/plugins/servlet/upm/manage/all"
else
    echo "FAILED: HTTP $HTTP_CODE"
    echo "$BODY"
    exit 1
fi
