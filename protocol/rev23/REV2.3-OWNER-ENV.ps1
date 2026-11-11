# Environment inspection only; uses the existing installation, without install/upgrade.
$ErrorActionPreference = 'Stop'
. 'C:/Espressif/tools/Microsoft.v5.5.2.PowerShell_profile.ps1'
if ([IO.Path]::GetFullPath($env:IDF_PATH).Replace('\','/').TrimEnd('/') -cne 'C:/esp/v5.5.2/esp-idf') { throw 'Expected existing ESP-IDF 5.5.2.' }
$rev23Python = 'C:/Espressif/tools/python/v5.5.2/venv/Scripts/python.exe'
& $rev23Python --version
if ($LASTEXITCODE -ne 0) { throw 'Existing Python unavailable; stop without reinstall.' }
& $rev23Python 'C:/esp/v5.5.2/esp-idf/tools/idf_tools.py' check-python-dependencies
if ($LASTEXITCODE -ne 0) { throw 'Existing dependencies unavailable; stop without changing versions.' }
$rev23Version = & $rev23Python 'C:/esp/v5.5.2/esp-idf/tools/idf.py' --version
if ($LASTEXITCODE -ne 0 -or -not ($rev23Version -match '^ESP-IDF v5.5.2')) { throw 'Wrong SDK version.' }
Write-Output $rev23Version
