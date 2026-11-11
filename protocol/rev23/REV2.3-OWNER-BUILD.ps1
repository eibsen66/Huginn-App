param([string]$BuildDir = 'C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.3-20261104', [string]$PreparationDir = 'C:/HuginnEIS/Evidence/REV2.3-PREPARATION')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/REV2.3-OWNER-ENV.ps1"
$rev23Helper = 'C:/HuginnEIS/Tools/rev23_release.py'
# Python records raw merged output without PowerShell 5.1 treating warnings on
# native stderr as terminating errors. It pins before invoking the existing IDF.
& $rev23Python -B $rev23Helper build --build $BuildDir --preparation $PreparationDir
if ($LASTEXITCODE -ne 0) { throw 'Build or provenance failed; retain this attempt/logs. Do not flash.' }
# Build only. VERIFY, FLASH and capture are separate owner commands.
