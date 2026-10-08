$ErrorActionPreference='Stop'
$launcherProject = Join-Path $PSScriptRoot 'HuginnAPP.csproj'
if (-not (dotnet --list-sdks)) { throw 'Packaging requires the .NET 9 SDK and Windows NativeAOT C++ toolchain; no SDK found.' }
dotnet publish $launcherProject -r win-x64 -c Release -o (Join-Path $PSScriptRoot '../dist/launcher')
if ($LASTEXITCODE -ne 0) { throw 'NativeAOT packaging failed. No framework-dependent fallback is authorized.' }
