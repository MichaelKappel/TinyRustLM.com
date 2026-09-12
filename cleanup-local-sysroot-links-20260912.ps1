$ErrorActionPreference = 'Stop'
$root = 'E:\Source\Rust\TinyRustLM.com\artifacts\verification\arm64-sysroot'
$pairs = @(
    @{link=(Join-Path $root 'lib\libstdc++.so.6'); target=(Join-Path $root 'lib\libstdc++.so.6.0.33')},
    @{link=(Join-Path $root 'usr\lib\aarch64-linux-gnu\libz.so.1'); target=(Join-Path $root 'usr\lib\aarch64-linux-gnu\libz.so.1.3')}
)
# Retain required linker aliases without external junctions or duplicate payloads.
foreach ($pair in $pairs) {
    foreach ($file in @($pair.link,$pair.target)) { if (-not [IO.Path]::GetFullPath($file).StartsWith($root+'\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected sysroot path' } }
    $link = Get-Item -LiteralPath $pair.link -Force
    if (-not ($link.Attributes -band [IO.FileAttributes]::ReparsePoint)) { continue }
    $target = Get-Item -LiteralPath $pair.target -Force
    if ($target.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Expected physical library' }
    if ([IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $pair.link) $link.Target[0])) -ne $pair.target) { throw 'Unexpected symbolic link target' }
    Remove-Item -LiteralPath $pair.link -Force
    $null = New-Item -ItemType HardLink -Path $pair.link -Target $pair.target
}
