[CmdletBinding()]
param([string]$AdbPath,[string]$Address='127.0.0.1:5555',[string]$DeviceId)
$ErrorActionPreference='Stop'
if (-not $AdbPath) {
  $candidates=@()
  if ($env:ANDROID_HOME) { $candidates+=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe' }
  if ($env:ANDROID_SDK_ROOT) { $candidates+=Join-Path $env:ANDROID_SDK_ROOT 'platform-tools/adb.exe' }
  if ($env:LOCALAPPDATA) { $candidates+=Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe' }
  $fromPath=Get-Command adb.exe -ErrorAction SilentlyContinue
  if ($fromPath) { $candidates+=$fromPath.Source }
  $AdbPath=$candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $AdbPath -or -not (Test-Path -LiteralPath $AdbPath -PathType Leaf)) {
  throw 'Khong tim thay adb.exe. Cai Android SDK Platform-Tools trong Android Studio; chay lai script khong truyen duong dan mau.'
}
$connected=@(& $AdbPath devices)
if ($LASTEXITCODE -ne 0) { throw 'Khong doc duoc danh sach thiet bi ADB.' }
$devices=@($connected | ForEach-Object { if ($_ -match '^([^\s]+)\s+device(?:\s|$)') { $matches[1] } })
$serial=$DeviceId
if (-not $serial -and -not $PSBoundParameters.ContainsKey('Address')) {
  if ($devices.Count -eq 1) { $serial=$devices[0] }
  elseif ($Address -in $devices) { $serial=$Address }
}
if (-not $serial) {
  & $AdbPath connect $Address
  if ($LASTEXITCODE -ne 0) { throw 'Chua ket noi LDPlayer. Mo LDPlayer va bat ADB debugging cuc bo.' }
  $serial=$Address
}
$state=(& $AdbPath -s $serial get-state 2>$null)
if ($LASTEXITCODE -ne 0 -or $state -ne 'device') {
  throw 'LDPlayer chua san sang. Mo LDPlayer; chi giu mot emulator, roi chay lai script.'
}
foreach ($port in @(8080,8090)) {
  & $AdbPath -s $serial reverse "tcp:$port" "tcp:$port"
  if ($LASTEXITCODE -ne 0) { throw "Khong ket noi duoc cong $port tren $serial." }
}
Write-Host "Da san sang: $serial"
Write-Host 'Cua so nay: npm start'
Write-Host 'Terminal thu hai, cung thu muc: npm run android'
