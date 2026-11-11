$ErrorActionPreference = 'Stop'
. 'C:/HuginnEIS/REV2.9-OWNER-ENV.ps1'
& $rev29Python -B 'C:/HuginnEIS/Tools/rev29_release.py' prepare
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed; no build.' }
& 'C:/HuginnEIS/REV2.9-OWNER-BUILD.ps1'
if ($LASTEXITCODE -ne 0) { throw 'Build failed; retain logs.' }
