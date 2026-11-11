param([Parameter(Mandatory=$true)][string]$EvidenceDir)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$evidence=[IO.Path]::GetFullPath($EvidenceDir).Replace('\','/').TrimEnd('/')
if (-not $evidence.StartsWith('C:/HuginnAPP/build/sd-card-test-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Evidence must be in the designated host workspace.' }
New-Item -ItemType Directory -Path $evidence -ErrorAction Stop | Out-Null
function Save-Json($value,$name) { $value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath "$evidence/$name" -Encoding UTF8 }
function Identity {
    $parts=@(Get-Partition -DriveLetter D)
    if($parts.Count -ne 1) {throw 'D: has ambiguous partition mapping.'}
    $disk=$parts[0] | Get-Disk
    $vol=Get-Volume -DriveLetter D
    $logical=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'"
    if($disk.Size -ne 31914983424 -or "$($disk.BusType)" -ne 'USB' -or "$($disk.PartitionStyle)" -ne 'MBR' -or $disk.IsBoot -or $disk.IsSystem -or $disk.IsReadOnly) {throw 'STOP: disk identity/safety mismatch.'}
    if($vol.Size -ne 31902400512 -or $vol.FileSystem -ne 'FAT32' -or $vol.FileSystemLabel -ine 'HuginnEIS' -or $logical.VolumeSerialNumber -ne '63323864') {throw 'STOP: volume identity mismatch.'}
    return [ordered]@{disk_number=$disk.Number;disk_size=$disk.Size;bus="$($disk.BusType)";partition_style="$($disk.PartitionStyle)";is_boot=$disk.IsBoot;is_system=$disk.IsSystem;disk_unique_id=$disk.UniqueId;volume_unique_id=$vol.UniqueId;volume_serial=$logical.VolumeSerialNumber;label=$vol.FileSystemLabel;filesystem=$vol.FileSystem;volume_size=$vol.Size;free_bytes=$vol.SizeRemaining}
}
$state=[ordered]@{status='INCOMPLETE';phase='preflight';started_utc=[DateTime]::UtcNow.ToString('o');written_bytes=0L;read_bytes=0L;verified_bytes=0L;files=@();errors=@();no_format=$true;no_partition_changes=$true;no_com_access=$true;read_mode='Win32 FILE_FLAG_NO_BUFFERING';write_mode='NO_BUFFERING + WRITE_THROUGH + FlushFileBuffers + close';logical_copy_test=$true}
$files=New-Object System.Collections.Generic.List[object]
try {
    $id=Identity;Save-Json $id 'identity-before.json';$state.identity=$id
    $inventory=@(Get-ChildItem -LiteralPath D:/ -Force -Recurse | Select-Object FullName,Attributes,Length)
    Save-Json $inventory 'inventory-before.json'
    $allowed=@('D:/System Volume Information','D:/System Volume Information/WPSettings.dat','D:/System Volume Information/IndexerVolumeGuid')
    foreach($item in $inventory){if($allowed -inotcontains $item.FullName.Replace('\','/')) {throw "STOP: unexpected existing content: $($item.FullName)"}}
    Add-Type -Path "$PSScriptRoot/sd-full-space-native.cs"
    $cluster=[SdFullSpaceNative]::ClusterBytes();$state.cluster_bytes=$cluster;$state.sector_bytes=[SdFullSpaceNative]::SectorBytes
    if($cluster -le 0 -or (1073741824 % $cluster) -ne 0) {throw 'Unexpected cluster size.'}
    $folder='D:/HUGINN_SD_TEST_'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
    $resolved=[IO.Path]::GetFullPath($folder).Replace('\','/')
    if(-not $resolved.StartsWith('D:/HUGINN_SD_TEST_',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $folder)) {throw 'Unsafe or existing test directory.'}
    $state.test_directory=$folder
    New-Item -ItemType Directory -Path $folder | Out-Null
    $seedBytes=New-Object byte[] 8;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($seedBytes);$rng.Dispose();$seed=[BitConverter]::ToUInt64($seedBytes,0)
    $state.pattern='SplitMix64(seed + global 8-byte word index), little endian';$state.seed=$seed.ToString()
    [SdFullSpaceNative]::ProgressPath="$evidence/progress.json";[SdFullSpaceNative]::ExpectedBytes=$id.free_bytes
    $state.phase='writing';Save-Json $state 'result.json';[SdFullSpaceNative]::BeginPhase('writing');$clock=[Diagnostics.Stopwatch]::StartNew()
    for($index=1;;$index++) {
        $free=[long](Get-Volume -DriveLetter D).SizeRemaining
        $length=[long]([Math]::Floor([Math]::Min([long]1073741824,[long]$free)/$cluster)*$cluster)
        if($length -eq 0) {break}
        $name='T{0:D7}.BIN' -f $index;$path="$folder/$name"
        $record=[ordered]@{name=$name;bytes=$length;offset=[SdFullSpaceNative]::WrittenBytes;expected_sha256=$null;verified=$false}
        $files.Add($record)
        $r=[SdFullSpaceNative]::Write($path,$length,[SdFullSpaceNative]::WrittenBytes,$seed)
        $record.expected_sha256=$r.Sha256;$record.write_seconds=$r.Seconds
        $state.written_bytes=[SdFullSpaceNative]::WrittenBytes;$state.files=$files.ToArray();Save-Json $state 'result.json'
        Write-Output ("WRITE file={0} bytes={1} total={2}" -f $name,$r.Bytes,$state.written_bytes)
    }
    $state.write_seconds=$clock.Elapsed.TotalSeconds;$state.free_after_write=[long](Get-Volume -DriveLetter D).SizeRemaining
    $state.filesystem_overhead_bytes=[long]$id.free_bytes-[SdFullSpaceNative]::WrittenBytes-$state.free_after_write
    if($state.free_after_write -ge $cluster) {throw 'Free allocatable clusters remain: coverage incomplete.'}
    # Every native write handle has been flushed and disposed before this point.
    $state.write_complete_utc=[DateTime]::UtcNow.ToString('o');$state.phase='reading';Save-Json $state 'result.json'
    $readId=Identity;if($readId.disk_unique_id -ne $id.disk_unique_id -or $readId.volume_unique_id -ne $id.volume_unique_id) {throw 'Card identity changed before read.'}
    Save-Json $readId 'identity-before-read.json';[SdFullSpaceNative]::BeginPhase('reading');$clock.Restart()
    foreach($record in $files){$r=[SdFullSpaceNative]::Read("$folder/$($record.name)",$record.bytes);$record.actual_sha256=$r.Sha256;$record.read_seconds=$r.Seconds
        if($r.Sha256 -cne $record.expected_sha256) {throw "SHA256 mismatch: $($record.name)"}
        $record.verified=$true;$state.verified_bytes=[long]$state.verified_bytes+$record.bytes;$state.read_bytes=[SdFullSpaceNative]::ReadBytes;$state.files=$files.ToArray();Save-Json $state 'result.json'
        Write-Output ("VERIFIED file={0} bytes={1} total={2}" -f $record.name,$r.Bytes,$state.verified_bytes)
    }
    $state.read_seconds=$clock.Elapsed.TotalSeconds
    if($state.verified_bytes -ne [SdFullSpaceNative]::WrittenBytes -or [SdFullSpaceNative]::ReadBytes -ne [SdFullSpaceNative]::WrittenBytes) {throw 'Not all written bytes verified.'}
    $state.write_mib_per_second=$state.written_bytes/1048576/$state.write_seconds;$state.read_mib_per_second=$state.read_bytes/1048576/$state.read_seconds
    $state.phase='verified_before_cleanup';Save-Json $state 'result.json';$cleanupId=Identity
    if($cleanupId.volume_unique_id -ne $id.volume_unique_id -or $cleanupId.disk_unique_id -ne $id.disk_unique_id) {throw 'Identity changed before cleanup.'}
    $actual=@(Get-ChildItem -LiteralPath $folder -Force)
    if($actual.Count -ne $files.Count) {throw 'Unexpected entries in test directory; cleanup withheld.'}
    foreach($item in $actual){if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Name -notmatch '^T[0-9]{7}\.BIN$' -or $item.Name -notin $files.name) {throw 'Unexpected test-directory entry; cleanup withheld.'}}
    foreach($record in $files){$target=[IO.Path]::GetFullPath("$folder/$($record.name)").Replace('\','/');if(-not $target.StartsWith($resolved+'/',[StringComparison]::OrdinalIgnoreCase)){throw 'Cleanup containment failed.'};Remove-Item -LiteralPath $target -Force}
    Remove-Item -LiteralPath $folder
    $after=Identity;Save-Json $after 'identity-after.json';$state.free_after_cleanup=$after.free_bytes;$state.cleanup_complete=$true;$state.status='PASS';$state.phase='complete'
} catch {
    $state.errors=@($_.Exception.ToString());$state.status='FAIL';$state.phase='stopped_preserving_files';Write-Output $_.Exception.Message
} finally {
    if('SdFullSpaceNative' -as [type]){$state.written_bytes=[SdFullSpaceNative]::WrittenBytes;$state.read_bytes=[SdFullSpaceNative]::ReadBytes}
    $state.files=$files.ToArray();$state.ended_utc=[DateTime]::UtcNow.ToString('o');Save-Json $state 'result.json';Write-Output ("RESULT {0} {1}/result.json" -f $state.status,$evidence)
}
if($state.status -ne 'PASS'){exit 1}
