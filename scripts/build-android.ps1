[CmdletBinding()]
param([string]$Architectures)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot
try {
  if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME=Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
  $gradleArgs=@('-p','android','assembleDebug','--console=plain','--max-workers=2')
  if ($Architectures) {
    if ($Architectures -notmatch '^(arm64-v8a|armeabi-v7a|x86_64|x86)(,(arm64-v8a|armeabi-v7a|x86_64|x86))*$') { throw 'Unsupported Android architecture list' }
    $gradleArgs+="-PreactNativeArchitectures=$Architectures"
  }
  & ./android/gradlew.bat @gradleArgs
  if ($LASTEXITCODE -ne 0) { throw 'Android debug build failed' }
  New-Item -ItemType Directory -Force artifacts | Out-Null
  Copy-Item -LiteralPath android/app/build/outputs/apk/debug/app-debug.apk -Destination artifacts/careconnect-react-native-debug.apk -Force
  Write-Host 'APK: artifacts/careconnect-react-native-debug.apk'
  Write-Host 'React Native CLI debug build; start Metro on port 8090 before opening the app.'
} finally { Pop-Location }
