#!/usr/bin/env bash
# Build a signed, installable Android APK without Gradle / Android Studio.
# Needs: JDK, and the Ubuntu/Debian Android packages:
#   sudo apt-get install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange
# Usage: tools/build-apk.sh            (builds the web game first)
#        SKIP_WEB=1 tools/build-apk.sh (reuse dist/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LITE="$ROOT/android-lite"
SDK="${ANDROID_SDK:-/usr/lib/android-sdk}"
JAR="$SDK/platforms/android-23/android.jar"
OUT="$LITE/build"
KS="$LITE/rxshift-release.jks"; KS_PASS="${KS_PASS:-rxshift-release}"; ALIAS=rxshift
APK="$ROOT/RxShift-Pharmacy-Sim.apk"

[ -n "${SKIP_WEB:-}" ] || (cd "$ROOT" && npx vite build)
rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/assets/www"
cp -r "$ROOT/dist/." "$OUT/assets/www/"

cd "$LITE"
echo "• resources"
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$JAR"
echo "• java"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -d "$OUT/classes" \
  "$OUT/gen/com/zrubix/rxshift/R.java" src/com/zrubix/rxshift/*.java
echo "• dex"
dalvik-exchange --dex --output="$OUT/classes.dex" "$OUT/classes"
echo "• package"
aapt package -f -M AndroidManifest.xml -S res -A "$OUT/assets" -I "$JAR" -F "$OUT/app.unsigned.apk" \
  -0 jpg -0 png -0 woff2   # .glb and .html are deflated (≈30% smaller APK)
(cd "$OUT" && aapt add -f app.unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/app.unsigned.apk" "$OUT/app.aligned.apk"
if [ ! -f "$KS" ]; then
  echo "• creating signing key $KS"
  keytool -genkeypair -noprompt -keystore "$KS" -storetype PKCS12 -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=RxShift Pharmacy Sim, O=Zrubix, C=IN"
fi
echo "• sign"
apksigner sign --ks "$KS" --ks-key-alias "$ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "$APK" "$OUT/app.aligned.apk"
apksigner verify "$APK"
echo "✔ $APK ($(du -h "$APK" | cut -f1))"
