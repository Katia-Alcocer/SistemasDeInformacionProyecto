FROM mysql:8.4
COPY database/schema_completo_v2.sql /docker-entrypoint-initdb.d/10-schema.sql
COPY database/migrations/001_grupos_inactivos.sql /docker-entrypoint-initdb.d/15-grupos-inactivos.sql
COPY database/migrations/002_politicas_admision.sql /docker-entrypoint-initdb.d/16-politicas-admision.sql
COPY database/migrations/003_recepcion_salud.sql /docker-entrypoint-initdb.d/17-recepcion-salud.sql
COPY database/migrations/004_actividades_aula.sql /docker-entrypoint-initdb.d/18-actividades-aula.sql
COPY database/migrations/005_dosis_persistentes.sql /docker-entrypoint-initdb.d/19-dosis-persistentes.sql
COPY database/migrations/006_comedor.sql /docker-entrypoint-initdb.d/19b-comedor.sql
COPY database/migrations/007_salida_segura.sql /docker-entrypoint-initdb.d/19c-salida-segura.sql
COPY database/migrations/008_enfermeria.sql /docker-entrypoint-initdb.d/19d-enfermeria.sql
COPY database/migrations/009_reportes_autoridad.sql /docker-entrypoint-initdb.d/19e-reportes-autoridad.sql
COPY database/migrations/010_finanzas.sql /docker-entrypoint-initdb.d/19f-finanzas.sql
COPY database/migrations/011_prorrogas_idempotencia.sql /docker-entrypoint-initdb.d/19g-prorrogas-idempotencia.sql
COPY database/migrations/012_anulacion_pagos.sql /docker-entrypoint-initdb.d/19h-anulacion-pagos.sql
COPY database/migrations/013_preinscripcion_materno.sql /docker-entrypoint-initdb.d/19i-preinscripcion-materno.sql
COPY docker/mysql/20-app-user.sh /docker-entrypoint-initdb.d/20-app-user.sh
