$ErrorActionPreference = 'Stop'
. C:/HuginnEIS/REV2.6-OWNER-ENV.ps1
& $rev26Python -B C:/HuginnEIS/Tools/rev26_release.py prepare
if ($LASTEXITCODE -ne 0) { throw 'Rev. 2.6 preparation failed; preserve any receipt.' }
& $rev26Python -B C:/HuginnEIS/Tools/rev26_release.py check
if ($LASTEXITCODE -ne 0) { throw 'Rev. 2.6 input check failed.' }
if (Test-Path C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.6-20261105) { throw 'Unexpected target build directory during preparation.' }
