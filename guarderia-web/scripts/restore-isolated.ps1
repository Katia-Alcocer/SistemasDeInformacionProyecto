param(
  [Parameter(Mandatory=$true)][string]$BackupDirectory,
  [Parameter(Mandatory=$true)][string]$MysqlPassword,
  [switch]$ConfirmIsolated
)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmIsolated) { throw 'La restauración exige -ConfirmIsolated y debe ejecutarse contra una instancia temporal, nunca contra producción.' }
$source = [System.IO.Path]::GetFullPath($BackupDirectory)
$sql = Join-Path $source 'guarderia.sql'
$files = Join-Path $source 'private_uploads.tar.gz'
$checks = Join-Path $source 'SHA256SUMS'
if (-not (Test-Path $sql) -or -not (Test-Path $files) -or -not (Test-Path $checks)) { throw 'Faltan archivos del respaldo.' }

$hashes = @(Get-FileHash -Algorithm SHA256 $sql,$files | ForEach-Object { "$($_.Hash)  $($_.Path | Split-Path -Leaf)" })
$expected = @(Get-Content $checks | ForEach-Object { $_.Trim() })
if (Compare-Object $expected $hashes) { throw 'La verificación SHA256 falló.' }

$name = "guarderia-restore-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$volume = "$name-data"
$privateVolume = "$name-private"
try {
  docker volume create $volume | Out-Null
  docker volume create $privateVolume | Out-Null
  docker run --name $name -d -e MYSQL_ROOT_PASSWORD=$MysqlPassword -e MYSQL_DATABASE=guarderia -v "$volume`:/var/lib/mysql" mysql:8.4 --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci | Out-Null
  for($i=0;$i -lt 90;$i++) { Start-Sleep -Seconds 2; $ready=docker exec $name sh -ec 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqladmin ping -h127.0.0.1 -uroot --silent' 2>$null; if($LASTEXITCODE -eq 0){break}; if($i -eq 89){throw 'MySQL aislado no inició.'} }
  docker cp $sql "$name`:/tmp/guarderia.sql"
  docker exec $name mysql "-uroot" "-p$MysqlPassword" "-h127.0.0.1" guarderia -e "source /tmp/guarderia.sql"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo importar el dump MySQL.' }
  $count = docker exec $name mysql "-uroot" "-p$MysqlPassword" "-h127.0.0.1" -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='guarderia'"
  if ([int]$count -lt 43) { throw "La restauración recuperó solo $count tablas." }
  docker run --rm -v "$files`:/source.tar.gz" -v "$privateVolume`:/target" mysql:8.4 sh -ec 'tar -xzf /source.tar.gz -C /target'
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo restaurar el volumen privado.' }
  Write-Output "Restauración aislada verificada: $count tablas y volumen privado recuperados."
} finally {
  docker rm -f $name 2>$null | Out-Null
  docker volume rm $volume 2>$null | Out-Null
  docker volume rm $privateVolume 2>$null | Out-Null
}
