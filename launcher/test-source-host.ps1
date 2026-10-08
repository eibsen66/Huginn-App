param([switch]$Development,[switch]$BrowserTests)
$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'Program.cs')
$appRoot = Split-Path $PSScriptRoot -Parent
$fixedPort = if ($Development) {8768} else {8767}
exit [HuginnLauncher]::Run($appRoot,$fixedPort,$false,[bool]$BrowserTests)
