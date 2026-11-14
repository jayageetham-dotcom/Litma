#!/usr/bin/env bash
# Builds the Mac App Store package (release/**/Litma-mac-store.pkg) on a macOS runner.
# Run by Actions → Desktop store builds (.github/workflows/desktop-stores.yml) from apps/desktop.
#
# Env (from repository secrets): MAS_CSC_LINK, MAS_CSC_KEY_PASSWORD (Apple Distribution .p12, base64),
# MAS_INSTALLER_CSC_LINK, MAS_INSTALLER_CSC_KEY_PASSWORD (Mac Installer Distribution .p12, base64),
# MAS_PROVISION_PROFILE_BASE64; BUILD_NUMBER (CFBundleVersion, must rise with every upload).
#
# Why not CSC_LINK: electron-builder 25.1.8 unlocks its own temporary keychain with the certificate's
# password (set-key-partition-list -k <p12 password>), which macOS rejects ("SecKeychainUnlock: The user
# name or passphrase you entered is not correct"). So this script makes the keychain itself and hands it
# to electron-builder with CSC_KEYCHAIN.
set -euo pipefail

for v in MAS_CSC_LINK MAS_CSC_KEY_PASSWORD MAS_INSTALLER_CSC_LINK MAS_INSTALLER_CSC_KEY_PASSWORD MAS_PROVISION_PROFILE_BASE64 BUILD_NUMBER; do
  if [ -z "${!v:-}" ]; then echo "::error::$v is not set"; exit 1; fi
done

cd "$(dirname "$0")/.."
work="$(mktemp -d)"
kc="$work/litma-mas.keychain-db"
kcpw="$(openssl rand -base64 32)"
before="$(security list-keychains -d user | tr -d '"' | xargs)"

cleanup() {
  security list-keychains -d user -s $before >/dev/null 2>&1 || true
  security delete-keychain "$kc" >/dev/null 2>&1 || true
  rm -rf "$work" build/litma-mas.provisionprofile
}
trap cleanup EXIT

security create-keychain -p "$kcpw" "$kc"
security set-keychain-settings -lut 21600 "$kc"
security unlock-keychain -p "$kcpw" "$kc"

import_p12() { # base64 text, password, file name
  printf '%s' "$1" | base64 --decode > "$work/$3"
  security import "$work/$3" -k "$kc" -P "$2" -f pkcs12 -T /usr/bin/codesign -T /usr/bin/productbuild -T /usr/bin/security >/dev/null
  rm -f "$work/$3"
}
import_p12 "$MAS_CSC_LINK" "$MAS_CSC_KEY_PASSWORD" app.p12
import_p12 "$MAS_INSTALLER_CSC_LINK" "$MAS_INSTALLER_CSC_KEY_PASSWORD" installer.p12

# Apple's intermediate certificate, so both identities count as valid even if the runner lacks it
if curl -fsSL --retry 3 https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer -o "$work/wwdr.cer"; then
  security import "$work/wwdr.cer" -k "$kc" >/dev/null 2>&1 || true
fi

security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$kcpw" "$kc" >/dev/null
security list-keychains -d user -s "$kc" $before

echo "Signing identities in the build keychain:"
security find-identity -v "$kc"
if ! security find-identity -v "$kc" | grep -q '"Apple Distribution\|"3rd Party Mac Developer Application'; then
  echo "::error::No valid Apple Distribution identity. Check MAS_CSC_LINK (export the certificate row, not the key) and MAS_CSC_KEY_PASSWORD."
  exit 1
fi
if ! security find-identity -v "$kc" | grep -q '"3rd Party Mac Developer Installer\|"Mac Installer Distribution'; then
  echo "::error::No valid Mac Installer identity. Check MAS_INSTALLER_CSC_LINK and MAS_INSTALLER_CSC_KEY_PASSWORD."
  exit 1
fi

printf '%s' "$MAS_PROVISION_PROFILE_BASE64" | base64 --decode > build/litma-mas.provisionprofile

npm run build
node scripts/copy-web.mjs

env -u CSC_LINK -u CSC_KEY_PASSWORD -u CSC_INSTALLER_LINK -u CSC_INSTALLER_KEY_PASSWORD \
  CSC_KEYCHAIN="$kc" \
  npx electron-builder --config electron-builder.stores.yml --mac mas --universal -c.buildVersion="$BUILD_NUMBER"
