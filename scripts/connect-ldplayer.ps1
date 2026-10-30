[CmdletBinding()]
param(
    [ValidatePattern('^(127\.0\.0\.1|localhost):[0-9]{1,5}$')]
    [string]$Address = '127.0.0.1:5555',
    [ValidateRange(1024, 65535)]
    [int]$GatewayPort = 8080,
    [string]$AdbPath
)

$ErrorActionPreference = 'Stop'

if (-not $AdbPath) {
    $sdkRoots = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT)
    if ($env:LOCALAPPDATA) {
        $sdkRoots += Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    }
    foreach ($sdkRoot in $sdkRoots) {
        if ($sdkRoot) {
            $candidate = Join-Path $sdkRoot 'platform-tools\adb.exe'
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $AdbPath = $candidate
                break
            }
        }
    }
}

if (-not $AdbPath -or -not (Test-Path -LiteralPath $AdbPath -PathType Leaf)) {
    throw 'Android SDK adb.exe was not found. Set ANDROID_HOME or pass -AdbPath.'
}

function Invoke-AndroidBridge {
    param([string[]]$AdbArguments)
    $response = & $AdbPath @AdbArguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "ADB failed: $($response -join [Environment]::NewLine)"
    }
    return ($response -join [Environment]::NewLine).Trim()
}

Write-Host 'Open LDPlayer and enable ADB debugging: local connection. Root is not required.'
Write-Host (Invoke-AndroidBridge -AdbArguments @('connect', $Address))
$deviceState = Invoke-AndroidBridge -AdbArguments @('-s', $Address, 'get-state')
if ($deviceState -ne 'device') {
    throw "LDPlayer is not ready ($deviceState). Start it and check local ADB debugging."
}

$apiLevel = Invoke-AndroidBridge -AdbArguments @('-s', $Address, 'shell', 'getprop', 'ro.build.version.sdk')
if ($apiLevel -notmatch '^\d+$' -or [int]$apiLevel -lt 24) {
    throw 'CareConnect requires Android 7.0/API 24 or newer. Use LDPlayer 9 (64-bit) or newer.'
}

$mapping = "tcp:$GatewayPort"
$null = Invoke-AndroidBridge -AdbArguments @('-s', $Address, 'reverse', $mapping, $mapping)
Write-Host "Connected: $Address (Android API $apiLevel)"
Write-Host "Gateway mapping: LDPlayer 127.0.0.1:$GatewayPort -> PC 127.0.0.1:$GatewayPort"
Write-Host "Run: flutter run -d $Address --dart-define=API_BASE_URL=http://127.0.0.1:$GatewayPort"
Write-Host 'Re-run this script after restarting LDPlayer. No emulator data is stored in this repo.'
