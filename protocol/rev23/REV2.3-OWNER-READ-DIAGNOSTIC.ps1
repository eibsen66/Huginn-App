$ErrorActionPreference = 'Stop'
$rev23Python = 'C:/Espressif/tools/python/v5.5.2/venv/Scripts/python.exe'
& $rev23Python -B 'C:/HuginnEIS/Tools/rev23_read_diagnostic.py'
if ($LASTEXITCODE -ne 0) { throw 'Saved diagnostic could not be read; no device connection was attempted.' }
