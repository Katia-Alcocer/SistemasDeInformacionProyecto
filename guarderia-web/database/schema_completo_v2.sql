-- GUARDERIA | Esquema integral v2.0 | MySQL 8.0.16+ (CHECK aplicado)
-- EJECUTAR SOLO EN UNA BASE NUEVA. No contiene DROP ni datos personales reales.
-- Fechas operativas: zona America/Mexico_City; establecer zona en la conexion de Express.
CREATE DATABASE IF NOT EXISTS guarderia CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE guarderia;

-- 01 SEGURIDAD
CREATE TABLE roles (
 id_rol SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(30) NOT NULL UNIQUE, nombre VARCHAR(70) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE usuarios (
 id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_rol SMALLINT UNSIGNED NOT NULL, nombre VARCHAR(160) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 deleted_at DATETIME NULL,
 CONSTRAINT fk_usuario_rol FOREIGN KEY(id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;
CREATE TABLE sesiones (
 id_sesion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_usuario BIGINT UNSIGNED NOT NULL, jti_hash CHAR(64) NOT NULL UNIQUE,
 emitida_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, expira_at DATETIME NOT NULL,
 revocada_at DATETIME NULL, ip_hash CHAR(64) NULL, agente_usuario VARCHAR(255) NULL,
 INDEX ix_sesiones_usuario (id_usuario,revocada_at,expira_at),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 CHECK(expira_at > emitida_at)
) ENGINE=InnoDB;
CREATE TABLE configuracion_operativa (
 id_config TINYINT UNSIGNED PRIMARY KEY, zona_horaria VARCHAR(60) NOT NULL DEFAULT 'America/Mexico_City',
 hora_inicio_ingreso TIME NOT NULL DEFAULT '08:00:00', hora_fin_ingreso TIME NOT NULL DEFAULT '09:00:00',
 hora_inicio_salida TIME NOT NULL DEFAULT '15:00:00', hora_fin_salida TIME NOT NULL DEFAULT '16:00:00',
 edad_minima_dias SMALLINT UNSIGNED NOT NULL DEFAULT 30,
 max_auxiliares TINYINT UNSIGNED NOT NULL DEFAULT 3,
 max_tolerancias_anuales TINYINT UNSIGNED NOT NULL DEFAULT 3,
 CHECK (id_config=1), CHECK(hora_inicio_ingreso < hora_fin_ingreso),
 CHECK(hora_inicio_salida < hora_fin_salida)
) ENGINE=InnoDB;

-- 02 AULAS Y PERSONAL
CREATE TABLE categorias_edad (
 id_categoria SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(10) NOT NULL UNIQUE, nombre VARCHAR(80) NOT NULL,
 edad_min_anios TINYINT UNSIGNED NOT NULL, edad_max_anios_exclusiva TINYINT UNSIGNED NOT NULL,
 CHECK(edad_max_anios_exclusiva > edad_min_anios)
) ENGINE=InnoDB;
CREATE TABLE grupos (
 id_grupo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_categoria SMALLINT UNSIGNED NOT NULL, codigo VARCHAR(20) NOT NULL UNIQUE,
 nombre VARCHAR(100) NOT NULL, capacidad SMALLINT UNSIGNED NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_categoria) REFERENCES categorias_edad(id_categoria), CHECK(capacidad > 0)
) ENGINE=InnoDB;
CREATE TABLE asignaciones_educadoras (
 id_asignacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_grupo BIGINT UNSIGNED NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 responsable BOOLEAN NOT NULL DEFAULT FALSE, fecha_inicio DATE NOT NULL, fecha_fin DATE NULL,
 FOREIGN KEY(id_grupo) REFERENCES grupos(id_grupo), FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_asignaciones_grupo (id_grupo,fecha_inicio,fecha_fin),
 CHECK(fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;

-- 03 PREINSCRIPCION Y EXPEDIENTES
CREATE TABLE preinscripciones (
 id_preinscripcion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre_contacto VARCHAR(160) NOT NULL, telefono_contacto VARCHAR(30) NOT NULL,
 email_contacto VARCHAR(190) NULL, fecha_probable_parto DATE NOT NULL,
 fecha_solicitud DATE NOT NULL, estado ENUM('PENDIENTE','EN_ESPERA','CONFIRMADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
 observaciones TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_preinscripciones_estado (estado,fecha_probable_parto)
) ENGINE=InnoDB;
CREATE TABLE menores (
 id_menor BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(40) NOT NULL UNIQUE, id_preinscripcion BIGINT UNSIGNED NULL UNIQUE,
 nombres VARCHAR(100) NOT NULL, apellido_paterno VARCHAR(100) NOT NULL,
 apellido_materno VARCHAR(100) NULL, fecha_nacimiento DATE NOT NULL,
 curp CHAR(18) NULL UNIQUE, registro_civil_validado BOOLEAN NOT NULL DEFAULT FALSE,
 estatus ENUM('PENDIENTE','ACTIVO','BAJA','EXPULSADO') NOT NULL DEFAULT 'PENDIENTE',
 fecha_alta DATE NULL, motivo_baja TEXT NULL, deleted_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(id_preinscripcion) REFERENCES preinscripciones(id_preinscripcion),
 INDEX ix_menores_estado (estatus,fecha_nacimiento)
) ENGINE=InnoDB;
CREATE TABLE historial_grupos (
 id_historial BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_grupo BIGINT UNSIGNED NOT NULL,
 fecha_inicio DATE NOT NULL, fecha_fin DATE NULL, motivo VARCHAR(200) NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_grupo) REFERENCES grupos(id_grupo),
 INDEX ix_historial_grupo_menor (id_menor,fecha_inicio,fecha_fin),
 CHECK(fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;
CREATE TABLE documentos_menor (
 id_documento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, tipo ENUM('ACTA_NACIMIENTO','CURP','OTRO') NOT NULL,
 ruta_segura VARCHAR(500) NOT NULL, hash_sha256 CHAR(64) NULL,
 validado BOOLEAN NOT NULL DEFAULT FALSE, validado_por BIGINT UNSIGNED NULL,
 registrado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(validado_por) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- 04 PERSONAS Y GAFETES (tutores principales y auxiliares se cuentan por vinculo)
CREATE TABLE personas (
 id_persona BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(180) NOT NULL, telefono VARCHAR(30) NULL,
 tipo_identificacion VARCHAR(40) NULL, identificacion_referencia VARCHAR(120) NULL,
 identificacion_ruta_segura VARCHAR(500) NULL, activo BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE menor_persona (
 id_vinculo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_persona BIGINT UNSIGNED NOT NULL,
 tipo ENUM('PRINCIPAL','AUXILIAR') NOT NULL, parentesco VARCHAR(70) NOT NULL,
 puede_recoger BOOLEAN NOT NULL DEFAULT TRUE, restriccion_judicial BOOLEAN NOT NULL DEFAULT FALSE,
 respaldo_restriccion VARCHAR(500) NULL, fecha_inicio DATE NOT NULL, fecha_fin DATE NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_persona) REFERENCES personas(id_persona),
 INDEX ix_vinculos_autorizados (id_menor,tipo,fecha_fin,puede_recoger),
 CHECK(fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;
CREATE TABLE gafetes (
 id_gafete BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, numero TINYINT UNSIGNED NOT NULL,
 codigo_hash CHAR(64) NOT NULL UNIQUE,
 estado ENUM('ACTIVO','REVOCADO','EXTRAVIADO') NOT NULL DEFAULT 'ACTIVO',
 fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 UNIQUE(id_menor,numero), CHECK(numero BETWEEN 1 AND 3)
) ENGINE=InnoDB;

-- 05 RECEPCION: intentos separados de asistencias aceptadas
CREATE TABLE intentos_ingreso (
 id_intento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 intento_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resultado ENUM('ACEPTADO','RECHAZADO') NOT NULL, motivo_rechazo TEXT NULL,
 nombre_acompanante VARCHAR(180) NULL, parentesco_acompanante VARCHAR(70) NULL,
 sintomas BOOLEAN NOT NULL DEFAULT FALSE, observaciones TEXT NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_intentos_menor_fecha (id_menor,intento_at),
 CHECK(resultado='ACEPTADO' OR motivo_rechazo IS NOT NULL)
) ENGINE=InnoDB;
CREATE TABLE asistencias (
 id_asistencia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_intento BIGINT UNSIGNED NOT NULL UNIQUE,
 fecha DATE NOT NULL, ingreso_at DATETIME NOT NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_intento) REFERENCES intentos_ingreso(id_intento),
 UNIQUE(id_menor,fecha), INDEX ix_asistencias_fecha (fecha)
) ENGINE=InnoDB;
CREATE TABLE inspecciones (
 id_inspeccion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_intento BIGINT UNSIGNED NOT NULL UNIQUE,
 realizada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 tiene_lesiones BOOLEAN NOT NULL DEFAULT FALSE, presenta_sintomas BOOLEAN NOT NULL DEFAULT FALSE,
 area ENUM('CUNERO','GENERAL') NOT NULL, observaciones TEXT NULL,
 FOREIGN KEY(id_intento) REFERENCES intentos_ingreso(id_intento)
) ENGINE=InnoDB;
CREATE TABLE lesiones (
 id_lesion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_inspeccion BIGINT UNSIGNED NOT NULL, id_lesion_anterior BIGINT UNSIGNED NULL,
 ubicacion VARCHAR(160) NOT NULL, descripcion TEXT NOT NULL, causa_reportada TEXT NULL,
 FOREIGN KEY(id_inspeccion) REFERENCES inspecciones(id_inspeccion),
 FOREIGN KEY(id_lesion_anterior) REFERENCES lesiones(id_lesion)
) ENGINE=InnoDB;

-- 06 RECETAS, MEDICAMENTOS Y DIETAS
CREATE TABLE recetas (
 id_receta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, nombre_medico VARCHAR(180) NOT NULL,
 cedula_profesional VARCHAR(50) NOT NULL, fecha_consulta DATE NOT NULL,
 vigencia_inicio DATE NOT NULL, vigencia_fin DATE NOT NULL,
 permite_convivencia BOOLEAN NOT NULL, diagnostico VARCHAR(255) NULL,
 ruta_documento VARCHAR(500) NOT NULL, verificada_por BIGINT UNSIGNED NULL,
 verificada_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(verificada_por) REFERENCES usuarios(id_usuario),
 INDEX ix_recetas_vigencia (id_menor,vigencia_inicio,vigencia_fin),
 CHECK(vigencia_fin >= vigencia_inicio)
) ENGINE=InnoDB;
CREATE TABLE tratamientos (
 id_tratamiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_receta BIGINT UNSIGNED NOT NULL, medicamento VARCHAR(180) NOT NULL,
 dosis DECIMAL(10,3) NOT NULL, unidad VARCHAR(30) NOT NULL,
 via ENUM('ORAL','TOPICA','OTRA') NOT NULL,
 fecha_inicio DATE NOT NULL, fecha_fin DATE NOT NULL,
 dosificador_requerido BOOLEAN NOT NULL DEFAULT TRUE,
 dosificador_entregado BOOLEAN NOT NULL DEFAULT FALSE,
 indicaciones TEXT NULL, FOREIGN KEY(id_receta) REFERENCES recetas(id_receta),
 CHECK(dosis > 0), CHECK(fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;
CREATE TABLE horarios_tratamiento (
 id_horario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_tratamiento BIGINT UNSIGNED NOT NULL, hora TIME NOT NULL,
 FOREIGN KEY(id_tratamiento) REFERENCES tratamientos(id_tratamiento), UNIQUE(id_tratamiento,hora)
) ENGINE=InnoDB;
CREATE TABLE administraciones_medicamento (
 id_administracion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_horario BIGINT UNSIGNED NOT NULL, fecha_programada DATE NOT NULL,
 estado ENUM('PENDIENTE','APLICADA','OMITIDA') NOT NULL DEFAULT 'PENDIENTE',
 aplicada_at DATETIME NULL, id_usuario BIGINT UNSIGNED NULL,
 dosis_aplicada DECIMAL(10,3) NULL, observaciones TEXT NULL,
 FOREIGN KEY(id_horario) REFERENCES horarios_tratamiento(id_horario),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 UNIQUE(id_horario,fecha_programada),
 CHECK(dosis_aplicada IS NULL OR dosis_aplicada > 0),
 CHECK(estado <> 'APLICADA' OR (aplicada_at IS NOT NULL AND id_usuario IS NOT NULL AND dosis_aplicada IS NOT NULL))
) ENGINE=InnoDB;
CREATE TABLE restricciones_alimentarias (
 id_restriccion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_receta BIGINT UNSIGNED NULL,
 tipo ENUM('ALERGIA_BASE','DIETA_MEDICA_TEMPORAL','OTRA') NOT NULL,
 descripcion VARCHAR(255) NOT NULL, inicio DATE NOT NULL, fin DATE NULL,
 activa BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_receta) REFERENCES recetas(id_receta),
 CHECK(fin IS NULL OR fin >= inicio),
 CHECK(tipo <> 'DIETA_MEDICA_TEMPORAL' OR (id_receta IS NOT NULL AND fin IS NOT NULL))
) ENGINE=InnoDB;

-- 07 INSUMOS (saldo + movimientos auditables)
CREATE TABLE tipos_insumo (
 id_tipo_insumo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(120) NOT NULL UNIQUE, unidad VARCHAR(40) NOT NULL, activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;
CREATE TABLE insumos_menor (
 id_insumo_menor BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_tipo_insumo BIGINT UNSIGNED NOT NULL,
 cantidad_actual DECIMAL(12,3) NOT NULL DEFAULT 0,
 consumo_diario_estimado DECIMAL(12,3) NULL,
 cantidad_requerida_ingreso DECIMAL(12,3) NOT NULL DEFAULT 0,
 obligatorio BOOLEAN NOT NULL DEFAULT TRUE, activo BOOLEAN NOT NULL DEFAULT TRUE,
 observaciones VARCHAR(255) NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(id_tipo_insumo) REFERENCES tipos_insumo(id_tipo_insumo),
 UNIQUE(id_menor,id_tipo_insumo),
 CHECK(cantidad_actual >= 0), CHECK(consumo_diario_estimado IS NULL OR consumo_diario_estimado > 0),
 CHECK(cantidad_requerida_ingreso >= 0)
) ENGINE=InnoDB;
CREATE TABLE movimientos_insumo (
 id_movimiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_insumo_menor BIGINT UNSIGNED NOT NULL,
 tipo ENUM('ENTRADA','CONSUMO','AJUSTE') NOT NULL,
 cantidad_delta DECIMAL(12,3) NOT NULL,
 saldo_resultante DECIMAL(12,3) NOT NULL,
 id_usuario BIGINT UNSIGNED NOT NULL,
 registrado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 motivo VARCHAR(255) NULL,
 FOREIGN KEY(id_insumo_menor) REFERENCES insumos_menor(id_insumo_menor),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 CHECK(cantidad_delta <> 0), CHECK(saldo_resultante >= 0),
 CHECK((tipo='ENTRADA' AND cantidad_delta > 0) OR (tipo='CONSUMO' AND cantidad_delta < 0) OR tipo='AJUSTE')
) ENGINE=InnoDB;
CREATE TABLE avisos_insumo (
 id_aviso BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_insumo_menor BIGINT UNSIGNED NOT NULL, fecha DATE NOT NULL,
 dias_estimados TINYINT UNSIGNED NOT NULL,
 notificado_por BIGINT UNSIGNED NOT NULL, observaciones VARCHAR(255) NULL,
 FOREIGN KEY(id_insumo_menor) REFERENCES insumos_menor(id_insumo_menor),
 FOREIGN KEY(notificado_por) REFERENCES usuarios(id_usuario),
 UNIQUE(id_insumo_menor,fecha,dias_estimados), CHECK(dias_estimados BETWEEN 0 AND 3)
) ENGINE=InnoDB;

-- 08 AULA, COMEDOR, ENFERMERIA
CREATE TABLE actividades_aula (
 id_actividad BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_grupo BIGINT UNSIGNED NOT NULL, fecha DATE NOT NULL,
 titulo VARCHAR(160) NOT NULL, descripcion TEXT NULL, id_educadora BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_grupo) REFERENCES grupos(id_grupo), FOREIGN KEY(id_educadora) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
CREATE TABLE participaciones_actividad (
 id_actividad BIGINT UNSIGNED NOT NULL, id_asistencia BIGINT UNSIGNED NOT NULL,
 observaciones TEXT NULL, PRIMARY KEY(id_actividad,id_asistencia),
 FOREIGN KEY(id_actividad) REFERENCES actividades_aula(id_actividad),
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia)
) ENGINE=InnoDB;
CREATE TABLE traslados_comedor (
 id_traslado BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL, entrada_at DATETIME NOT NULL,
 salida_at DATETIME NULL, id_responsable BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_responsable) REFERENCES usuarios(id_usuario),
 CHECK(salida_at IS NULL OR salida_at >= entrada_at)
) ENGINE=InnoDB;
CREATE TABLE registros_alimentacion (
 id_registro BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL, tipo_comida VARCHAR(50) NOT NULL,
 racion ENUM('NADA','CUARTO','MEDIA','TRES_CUARTOS','COMPLETA') NOT NULL,
 observaciones TEXT NULL, registrado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 id_usuario BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
CREATE TABLE atenciones_enfermeria (
 id_atencion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_asistencia BIGINT UNSIGNED NULL,
 id_usuario BIGINT UNSIGNED NOT NULL, atendido_at DATETIME NOT NULL,
 motivo TEXT NOT NULL, acciones TEXT NULL, requiere_recoleccion BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
CREATE TABLE mediciones (
 id_medicion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_atencion BIGINT UNSIGNED NULL,
 id_usuario BIGINT UNSIGNED NOT NULL, fecha DATE NOT NULL,
 peso_kg DECIMAL(6,3) NOT NULL, talla_cm DECIMAL(6,2) NOT NULL,
 tipo ENUM('MENSUAL','INCIDENTE') NOT NULL,
 periodo_mensual DATE NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(id_atencion) REFERENCES atenciones_enfermeria(id_atencion),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_mediciones_menor (id_menor,fecha),
 UNIQUE(id_menor,tipo,periodo_mensual),
 CHECK(peso_kg > 0), CHECK(talla_cm > 0),
 CHECK((tipo='MENSUAL' AND periodo_mensual IS NOT NULL AND DAYOFMONTH(periodo_mensual)=1)
    OR (tipo='INCIDENTE' AND periodo_mensual IS NULL))
) ENGINE=InnoDB;
CREATE TABLE alertas_recoleccion (
 id_alerta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_atencion BIGINT UNSIGNED NOT NULL, creada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 motivo TEXT NOT NULL, estado ENUM('PENDIENTE','CONTACTADO','CERRADO') NOT NULL DEFAULT 'PENDIENTE',
 FOREIGN KEY(id_atencion) REFERENCES atenciones_enfermeria(id_atencion)
) ENGINE=InnoDB;

-- 09 SALIDAS, RETARDOS, AUTORIDAD
CREATE TABLE entregas (
 id_entrega BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL UNIQUE,
 id_vinculo BIGINT UNSIGNED NULL, id_gafete BIGINT UNSIGNED NULL,
 nombre_portador_gafete VARCHAR(180) NULL,
 identidad_verificada BOOLEAN NOT NULL, metodo_verificacion ENUM('DOCUMENTO','CHECK','BIOMETRIA_EXTERNA') NOT NULL,
 confirmacion BOOLEAN NOT NULL, evidencia_confirmacion VARCHAR(500) NULL,
 entregado_at DATETIME NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_vinculo) REFERENCES menor_persona(id_vinculo),
 FOREIGN KEY(id_gafete) REFERENCES gafetes(id_gafete),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 CHECK(id_vinculo IS NOT NULL OR id_gafete IS NOT NULL),
 CHECK(id_gafete IS NULL OR nombre_portador_gafete IS NOT NULL),
 CHECK(identidad_verificada=TRUE AND confirmacion=TRUE)
) ENGINE=InnoDB;
CREATE TABLE retardos (
 id_retardo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL UNIQUE,
 id_persona BIGINT UNSIGNED NULL, aviso_at DATETIME NULL,
 justificacion TEXT NULL, evidencia VARCHAR(500) NULL,
 estado ENUM('PENDIENTE','APROBADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
 aprobado_por BIGINT UNSIGNED NULL, aprobado_at DATETIME NULL,
 anio SMALLINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_persona) REFERENCES personas(id_persona),
 FOREIGN KEY(aprobado_por) REFERENCES usuarios(id_usuario),
 INDEX ix_retardos_persona_anio (id_persona,anio,estado),
 CHECK(estado <> 'APROBADO' OR (aprobado_por IS NOT NULL AND aprobado_at IS NOT NULL))
) ENGINE=InnoDB;
CREATE TABLE reportes_autoridad (
 id_reporte BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL, tipo ENUM('NO_RECOGIDO','INCIDENTE','OTRO') NOT NULL,
 generado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 estado ENUM('GENERADO','REVISADO','ENVIADO','CANCELADO') NOT NULL DEFAULT 'GENERADO',
 referencia_envio VARCHAR(160) NULL, enviado_at DATETIME NULL,
 documento_ruta VARCHAR(500) NULL, id_usuario BIGINT UNSIGNED NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 UNIQUE(id_asistencia,tipo),
 CHECK(estado <> 'ENVIADO' OR (enviado_at IS NOT NULL AND referencia_envio IS NOT NULL))
) ENGINE=InnoDB;

-- 10 FINANZAS
CREATE TABLE cuotas (
 id_cuota BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, periodo_inicio DATE NOT NULL,
 periodo_fin DATE NOT NULL, vencimiento DATE NOT NULL,
 importe DECIMAL(12,2) NOT NULL, estado ENUM('PENDIENTE','ANULADA') NOT NULL DEFAULT 'PENDIENTE',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 UNIQUE(id_menor,periodo_inicio,periodo_fin),
 CHECK(periodo_fin >= periodo_inicio), CHECK(importe >= 0)
) ENGINE=InnoDB;
CREATE TABLE pagos (
 id_pago BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_cuota BIGINT UNSIGNED NOT NULL, importe DECIMAL(12,2) NOT NULL,
 pagado_at DATETIME NOT NULL, metodo ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL,
 referencia VARCHAR(150) NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 estado ENUM('REGISTRADO','ANULADO') NOT NULL DEFAULT 'REGISTRADO',
 motivo_anulacion VARCHAR(255) NULL,
 FOREIGN KEY(id_cuota) REFERENCES cuotas(id_cuota),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario), CHECK(importe > 0)
) ENGINE=InnoDB;
CREATE TABLE prorrogas (
 id_prorroga BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_cuota BIGINT UNSIGNED NOT NULL, nueva_fecha DATE NOT NULL,
 motivo TEXT NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 autorizada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_cuota) REFERENCES cuotas(id_cuota), FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- 11 AUDITORIA (escribir desde servicios backend dentro de la misma transaccion)
CREATE TABLE auditoria_eventos (
 id_evento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_usuario BIGINT UNSIGNED NULL, entidad VARCHAR(90) NOT NULL,
 entidad_id BIGINT UNSIGNED NOT NULL, accion VARCHAR(70) NOT NULL,
 detalle JSON NULL, creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_auditoria_entidad (entidad,entidad_id,creado_at),
 INDEX ix_auditoria_fecha (creado_at)
) ENGINE=InnoDB;

INSERT INTO roles(codigo,nombre) VALUES
 ('ADMIN','Administracion'),('RECEPCION','Recepcion'),
 ('EDUCADORA','Educadora'),('ENFERMERIA','Enfermeria');
INSERT INTO categorias_edad(codigo,nombre,edad_min_anios,edad_max_anios_exclusiva) VALUES
 ('G0','Lactantes menores de un anio',0,1),
 ('G1','Un anio a menos de dos',1,2),
 ('G2','Dos anios a menos de tres',2,3),
 ('G3','Tres anios a menos de cuatro',3,4);
INSERT INTO configuracion_operativa(id_config) VALUES (1);
INSERT INTO tipos_insumo(nombre,unidad) VALUES
 ('Panales','pieza'),('Leche especial','ml'),('Cambios de ropa','juego'),('Cobija','pieza');
-- NOTA: Crear grupos concretos y asignar educadora responsable antes de activar menores.
-- NOTA: No se insertan usuarios con contrasenas predeterminadas.
