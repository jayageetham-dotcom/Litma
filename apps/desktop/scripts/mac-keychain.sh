# Sourced (not run) by the macOS step of .github/workflows/desktop.yml before electron-builder, when the
# Developer ID secrets exist:  source scripts/mac-keychain.sh
#
# Why: electron-builder 25.1.8 unlocks the keychain it makes from CSC_LINK with the certificate's
# password (set-key-partition-list -k <p12 password>), which macOS rejects ("SecKeychainUnlock: The
# user name or passphrase you entered is not correct"). So this makes the keychain itself with a known
# password, imports CSC_LINK (Developer ID Application .p12, base64) with CSC_KEY_PASSWORD, checks the
# identity, then hands the keychain over with CSC_KEYCHAIN and unsets CSC_LINK. The keychain is removed
# when the step's shell exits. Same approach as scripts/build-mas.sh (Mac App Store).

if [ -z "${CSC_LINK:-}" ] || [ -z "${CSC_KEY_PASSWORD:-}" ]; then
  echo "::error::mac-keychain.sh needs CSC_LINK and CSC_KEY_PASSWORD"
  exit 1
fi

LITMA_KC_DIR="$(mktemp -d)"
LITMA_KC="$LITMA_KC_DIR/litma-signing.keychain-db"
LITMA_KC_PW="$(openssl rand -base64 32)"
LITMA_KC_BEFORE="$(security list-keychains -d user | tr -d '"' | xargs)"

litma_kc_cleanup() {
  security list-keychains -d user -s $LITMA_KC_BEFORE >/dev/null 2>&1 || true
  security delete-keychain "$LITMA_KC" >/dev/null 2>&1 || true
  rm -rf "$LITMA_KC_DIR"
}
trap litma_kc_cleanup EXIT

security create-keychain -p "$LITMA_KC_PW" "$LITMA_KC"
security set-keychain-settings -lut 21600 "$LITMA_KC"
security unlock-keychain -p "$LITMA_KC_PW" "$LITMA_KC"

printf '%s' "$CSC_LINK" | base64 --decode > "$LITMA_KC_DIR/cert.p12"
security import "$LITMA_KC_DIR/cert.p12" -k "$LITMA_KC" -P "$CSC_KEY_PASSWORD" -f pkcs12 \
  -T /usr/bin/codesign -T /usr/bin/productbuild -T /usr/bin/security >/dev/null
rm -f "$LITMA_KC_DIR/cert.p12"

# Developer ID certificates chain to Apple's Developer ID intermediate (G2 for new ones, G1 for older)
for ca in DeveloperIDG2CA.cer DeveloperIDCA.cer; do
  if curl -fsSL --retry 3 "https://www.apple.com/certificateauthority/$ca" -o "$LITMA_KC_DIR/$ca"; then
    security import "$LITMA_KC_DIR/$ca" -k "$LITMA_KC" >/dev/null 2>&1 || true
  fi
done

security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$LITMA_KC_PW" "$LITMA_KC" >/dev/null
security list-keychains -d user -s "$LITMA_KC" $LITMA_KC_BEFORE

echo "Signing identities in the build keychain:"
security find-identity -v -p codesigning "$LITMA_KC"
if ! security find-identity -v -p codesigning "$LITMA_KC" | grep -q '"Developer ID Application'; then
  echo "::error::No valid Developer ID Application identity. Check CSC_LINK (export the certificate row, not the key) and CSC_KEY_PASSWORD."
  exit 1
fi

export CSC_KEYCHAIN="$LITMA_KC"
unset CSC_LINK CSC_KEY_PASSWORD
