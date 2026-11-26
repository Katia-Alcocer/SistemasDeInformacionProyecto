param(
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$destination = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$sql = Join-Path $destination 'guarderia.sql'
$files = Join-Path $destination 'private_uploads.tar.gz'
$checks = Join-Path $destination 'SHA256SUMS'

$dumpCommand = 'docker compose exec -T mysql sh -ec "export MYSQL_PWD=$MYSQL_ROOT_PASSWORD; exec mysqldump --user=root --single-transaction --routines --triggers --events --hex-blob guarderia" > "' + $sql + '"'
$filesCommand = 'docker compose exec -T backend sh -ec "exec tar -czf - -C /app/private_uploads ." > "' + $files + '"'
cmd.exe /d /c $dumpCommand
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el dump MySQL.' }
cmd.exe /d /c $filesCommand
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el respaldo de archivos privados.' }

if ((Get-Item $sql).Length -le 0 -or (Get-Item $files).Length -le 0) { throw 'El respaldo está vacío.' }
Get-FileHash -Algorithm SHA256 $sql,$files | ForEach-Object { "$($_.Hash)  $($_.Path | Split-Path -Leaf)" } | Set-Content -Encoding ascii -Path $checks
Write-Output "Respaldo creado en $destination"
