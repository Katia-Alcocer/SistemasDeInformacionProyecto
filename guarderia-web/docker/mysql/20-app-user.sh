#!/bin/bash
# El entrypoint oficial carga este archivo tras importar el esquema.
set -eu
: "${APP_DB_PASSWORD:?Falta APP_DB_PASSWORD}"
# Alfabeto restringido para que la interpolación en SQL sea inequívoca.
if [[ ! "$APP_DB_PASSWORD" =~ ^[A-Za-z0-9_-]{32,128}$ ]]; then
  echo 'APP_DB_PASSWORD debe contener 32–128 caracteres alfanuméricos, _ o -.' >&2
  exit 1
fi
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<SQL
CREATE USER 'guarderia_app'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT SELECT, INSERT ON guarderia.* TO 'guarderia_app'@'%';
SQL
# Privilegios por tabla: no conceder UPDATE de base y luego intentar
# revocarlo en una tabla, pues MySQL acumula los privilegios concedidos.
export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
while IFS= read -r table; do
  [[ "$table" =~ ^[a-z_]+$ ]] || exit 1
  mysql --protocol=socket -uroot -e "GRANT UPDATE ON guarderia.${table} TO 'guarderia_app'@'%';"
done < <(mysql --protocol=socket -uroot -Nse "SELECT table_name FROM information_schema.tables WHERE table_schema='guarderia' AND table_type='BASE TABLE' AND table_name NOT IN ('auditoria_eventos','ingredientes_comedor','platillos_comedor')")
