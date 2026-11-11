$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/REV2.3-OWNER-ENV.ps1"
# OWNER ONLY, after normal boot/REC WAIT. Close other readers. Never press RESET.
& $rev23Python -B 'C:/HuginnEIS/Tools/rev23_capture.py'
if ($LASTEXITCODE -ne 0) { throw 'Capture stopped; do not reconnect automatically or reset.' }
