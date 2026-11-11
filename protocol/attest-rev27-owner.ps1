$ErrorActionPreference = 'Stop'
. 'C:/HuginnEIS/REV2.7-OWNER-ENV.ps1'
& $rev27Python -B 'C:/HuginnAPP/protocol/finalize-rev27-owner.py'
if ($LASTEXITCODE -ne 0) { throw 'Preparation/check failed; preserve evidence. No target build requested.' }
