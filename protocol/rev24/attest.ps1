$ErrorActionPreference = 'Stop'
. C:/HuginnEIS/REV2.4-OWNER-ENV.ps1
& $rev24Python -B C:/HuginnEIS/Tools/rev24_release.py prepare
if ($LASTEXITCODE -ne 0) { throw 'Preparation attestation failed; preserve any receipt.' }
& $rev24Python -B C:/HuginnEIS/Tools/rev24_release.py check
if ($LASTEXITCODE -ne 0) { throw 'Prepared-input check failed.' }
