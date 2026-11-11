param([string]$BuildDir = 'C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.3-20261104', [string]$PreparationDir = 'C:/HuginnEIS/Evidence/REV2.3-PREPARATION')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/REV2.3-OWNER-ENV.ps1"
& $rev23Python -B 'C:/HuginnEIS/Tools/rev23_release.py' verify --build $BuildDir --preparation $PreparationDir
if ($LASTEXITCODE -ne 0) { throw 'Artifact, freshness, configuration or diagnostic selection check failed.' }
& $rev23Python -m esptool --chip esp32s3 image_info "$BuildDir/lvgl_porting.bin"
if ($LASTEXITCODE -ne 0) { throw 'Offline image inspection failed.' }
