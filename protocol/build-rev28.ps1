$ErrorActionPreference = 'Stop'
. 'C:/HuginnEIS/REV2.8-OWNER-ENV.ps1'
& $rev28Python -B 'C:/HuginnEIS/Tools/rev28_release.py' prepare
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed; no build.' }
& 'C:/HuginnEIS/REV2.8-OWNER-BUILD.ps1'
if ($LASTEXITCODE -ne 0) { throw 'Build failed; retain logs.' }
