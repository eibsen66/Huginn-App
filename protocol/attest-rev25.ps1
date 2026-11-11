$ErrorActionPreference = 'Stop'
. C:/HuginnEIS/REV2.5-OWNER-ENV.ps1
& $rev25Python -B C:/HuginnEIS/Tools/rev25_release.py prepare
if ($LASTEXITCODE -ne 0) { throw 'Rev. 2.5 preparation failed; preserve any receipt.' }
& $rev25Python -B C:/HuginnEIS/Tools/rev25_release.py check
if ($LASTEXITCODE -ne 0) { throw 'Rev. 2.5 prepared input check failed.' }
