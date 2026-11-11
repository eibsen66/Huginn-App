param([string]$BuildDir = 'C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.3-20261104', [string]$PreparationDir = 'C:/HuginnEIS/Evidence/REV2.3-PREPARATION')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/REV2.3-OWNER-ENV.ps1"
# OWNER ONLY: repeat verification, COM5 backup/layout checks, one app write,
# independent readback and protection comparison; normal boot only after PASS.
& $rev23Python -B 'C:/HuginnEIS/Tools/rev23_release.py' flash --build $BuildDir --preparation $PreparationDir
if ($LASTEXITCODE -ne 0) { throw 'Stopped without automatic retry/rollback. Preserve evidence and inspect the error.' }
