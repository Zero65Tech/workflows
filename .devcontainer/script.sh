#!/bin/bash

echo "@zero65:registry=https://asia-south1-npm.pkg.dev/zero65/npm/" > ~/.npmrc

if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" ]; then
    mkdir -p ~/.config/gcloud
    echo "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" | base64 --decode > ~/.config/gcloud/application_default_credentials.json
fi

npm update && npm run dev
