$ErrorActionPreference = 'Stop'
. C:/HuginnEIS/REV2.5-OWNER-ENV.ps1
& $rev25Python -B C:/HuginnEIS/Tools/rev25_release.py check
if ($LASTEXITCODE -ne 0) { throw 'Final Rev. 2.5 provenance check failed.' }
if (Test-Path C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.5-20261105) { throw 'Unexpected target build directory during preparation.' }
