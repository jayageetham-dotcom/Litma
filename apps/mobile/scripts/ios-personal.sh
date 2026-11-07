#!/bin/sh
# Put Litma on your own iPhone with a free Apple ID, to test without the App Store.
# The app then opens on its own, without the Mac, for 7 days; run this again to renew it.
# Needs a Mac with Xcode and Flutter, the iPhone plugged in and unlocked, and the Apple ID chosen
# once as the Team in Xcode (see README, "Your own iPhone with a free Apple ID").
# Extra arguments go to `flutter run` (for example: -d "Jagath's iPhone").
set -e
cd "$(dirname "$0")/.."
flutter pub get
# Release mode: a debug build only opens while the Mac is attached. The free account can't sign
# Sign in with Apple, so this build uses Runner-personal.entitlements (FLUTTER_XCODE_* settings
# are passed to xcodebuild).
FLUTTER_XCODE_CODE_SIGN_ENTITLEMENTS=Runner/Runner-personal.entitlements exec flutter run --release "$@"
