$ErrorActionPreference = 'Stop'
. 'C:/HuginnEIS/REV2.10-OWNER-ENV.ps1'
& $rev210Python -B 'C:/HuginnEIS/Tools/rev210_release.py' prepare
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed; no build.' }
& 'C:/HuginnEIS/REV2.10-OWNER-BUILD.ps1'
if ($LASTEXITCODE -ne 0) { throw 'Build failed; preserve logs.' }
