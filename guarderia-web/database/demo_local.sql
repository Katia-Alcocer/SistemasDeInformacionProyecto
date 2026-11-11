-- Semilla ficticia para la base local `guarderia`. Ejecutar una sola vez.
-- Añade datos de demostración sin borrar ni modificar filas existentes.
START TRANSACTION;
SET @hoy = CURRENT_DATE();
SET @admin = (SELECT u.id_usuario FROM usuarios u JOIN roles r USING(id_rol) WHERE r.codigo='ADMIN' AND u.activo=1 AND u.deleted_at IS NULL ORDER BY u.id_usuario LIMIT 1);
SET @recepcion = (SELECT u.id_usuario FROM usuarios u JOIN roles r USING(id_rol) WHERE r.codigo='RECEPCION' AND u.activo=1 AND u.deleted_at IS NULL ORDER BY u.id_usuario LIMIT 1);
SET @educadora = (SELECT u.id_usuario FROM usuarios u JOIN roles r USING(id_rol) WHERE r.codigo='EDUCADORA' AND u.activo=1 AND u.deleted_at IS NULL ORDER BY u.id_usuario LIMIT 1);
SET @enfermeria = (SELECT u.id_usuario FROM usuarios u JOIN roles r USING(id_rol) WHERE r.codigo='ENFERMERIA' AND u.activo=1 AND u.deleted_at IS NULL ORDER BY u.id_usuario LIMIT 1);

INSERT INTO tipos_insumo(nombre,unidad) VALUES ('Pañales talla mediana (demo)','pieza'),('Fórmula infantil etapa 3 (demo)','ml');
SET @tipo1=(SELECT id_tipo_insumo FROM tipos_insumo WHERE nombre='Pañales talla mediana (demo)');
SET @tipo2=(SELECT id_tipo_insumo FROM tipos_insumo WHERE nombre='Fórmula infantil etapa 3 (demo)');
INSERT INTO grupos(id_categoria,codigo,nombre,capacidad,activo) VALUES
((SELECT id_categoria FROM categorias_edad WHERE codigo='G2'),'DEMO-G2','Exploradores (demo)',12,1),
((SELECT id_categoria FROM categorias_edad WHERE codigo='G3'),'DEMO-G3','Pequeños artistas (demo)',14,1);
SET @grupo1=(SELECT id_grupo FROM grupos WHERE codigo='DEMO-G2');
SET @grupo2=(SELECT id_grupo FROM grupos WHERE codigo='DEMO-G3');
INSERT INTO personas(nombre,telefono,tipo_identificacion,identificacion_referencia) VALUES
('Mariana López (familia demo)','5550000101','FICTICIA','DEMO-FAM-001'),
('Carlos Herrera (familia demo)','5550000102','FICTICIA','DEMO-FAM-002'),
('Elena Cruz (familia demo)','5550000103','FICTICIA','DEMO-FAM-003');
SET @persona1=(SELECT id_persona FROM personas WHERE identificacion_referencia='DEMO-FAM-001');
SET @persona2=(SELECT id_persona FROM personas WHERE identificacion_referencia='DEMO-FAM-002');
SET @persona3=(SELECT id_persona FROM personas WHERE identificacion_referencia='DEMO-FAM-003');
INSERT INTO menores(codigo,nombres,apellido_paterno,apellido_materno,fecha_nacimiento,curp,registro_civil_validado,estatus,fecha_alta,requerimientos_insumos_revisados) VALUES
('DEMO-2026-001','Valentina','Ríos','Luna',DATE_SUB(@hoy,INTERVAL 35 MONTH),'FICTICIADEMO000001',0,'ACTIVO',@hoy,1),
('DEMO-2026-002','Mateo','Santos','Vega',DATE_SUB(@hoy,INTERVAL 42 MONTH),'FICTICIADEMO000002',0,'ACTIVO',@hoy,1);
SET @menor1=(SELECT id_menor FROM menores WHERE codigo='DEMO-2026-001');
SET @menor2=(SELECT id_menor FROM menores WHERE codigo='DEMO-2026-002');
INSERT INTO menor_persona(id_menor,id_persona,tipo,parentesco,puede_recoger,fecha_inicio) VALUES
(@menor1,@persona1,'PRINCIPAL','Madre (demo)',1,@hoy),(@menor1,@persona2,'AUXILIAR','Padre (demo)',1,@hoy),
(@menor2,@persona3,'PRINCIPAL','Madre (demo)',1,@hoy),(@menor2,@persona2,'AUXILIAR','Familiar autorizado (demo)',1,@hoy);
SET @vinculo1=(SELECT id_vinculo FROM menor_persona WHERE id_menor=@menor1 AND id_persona=@persona1);
SET @vinculo2=(SELECT id_vinculo FROM menor_persona WHERE id_menor=@menor2 AND id_persona=@persona3);
INSERT INTO asignaciones_educadoras(id_grupo,id_usuario,responsable,fecha_inicio) VALUES (@grupo1,@educadora,1,@hoy),(@grupo2,@educadora,1,@hoy);
INSERT INTO historial_grupos(id_menor,id_grupo,fecha_inicio,motivo) VALUES (@menor1,@grupo1,@hoy,'Ingreso de demostración'),(@menor2,@grupo2,@hoy,'Ingreso de demostración');
INSERT INTO gafetes(id_menor,numero,codigo_hash,estado) VALUES (@menor1,1,SHA2('DEMO-GAFETE-2026-001',256),'ACTIVO'),(@menor2,1,SHA2('DEMO-GAFETE-2026-002',256),'ACTIVO');
SET @gafete1=(SELECT id_gafete FROM gafetes WHERE codigo_hash=SHA2('DEMO-GAFETE-2026-001',256));
SET @gafete2=(SELECT id_gafete FROM gafetes WHERE codigo_hash=SHA2('DEMO-GAFETE-2026-002',256));
INSERT INTO insumos_menor(id_menor,id_tipo_insumo,cantidad_actual,consumo_diario_estimado,cantidad_requerida_ingreso,obligatorio,observaciones) VALUES
(@menor1,@tipo1,18,5,5,1,'Registro ficticio de capacitación'),(@menor2,@tipo2,900,180,180,1,'Registro ficticio de capacitación');
SET @insumo1=(SELECT id_insumo_menor FROM insumos_menor WHERE id_menor=@menor1 AND id_tipo_insumo=@tipo1);
SET @insumo2=(SELECT id_insumo_menor FROM insumos_menor WHERE id_menor=@menor2 AND id_tipo_insumo=@tipo2);
INSERT INTO movimientos_insumo(id_insumo_menor,tipo,cantidad_delta,saldo_resultante,id_usuario,motivo) VALUES (@insumo1,'ENTRADA',18,18,@recepcion,'Carga inicial demo'),(@insumo2,'ENTRADA',900,900,@recepcion,'Carga inicial demo');
INSERT INTO avisos_insumo(id_insumo_menor,fecha,dias_estimados,notificado_por,observaciones) VALUES (@insumo1,@hoy,3,@recepcion,'Reposición de demostración');
INSERT INTO intentos_ingreso(id_menor,id_usuario,intento_at,resultado,nombre_acompanante,parentesco_acompanante,sintomas,observaciones) VALUES
(@menor1,@recepcion,TIMESTAMP(@hoy,'08:12:00'),'ACEPTADO','Mariana López (familia demo)','Madre',0,'Ingreso ficticio'),(@menor2,@recepcion,TIMESTAMP(@hoy,'08:25:00'),'ACEPTADO','Elena Cruz (familia demo)','Madre',0,'Ingreso ficticio');
SET @intento1=(SELECT id_intento FROM intentos_ingreso WHERE id_menor=@menor1 AND DATE(intento_at)=@hoy ORDER BY id_intento DESC LIMIT 1);
SET @intento2=(SELECT id_intento FROM intentos_ingreso WHERE id_menor=@menor2 AND DATE(intento_at)=@hoy ORDER BY id_intento DESC LIMIT 1);
INSERT INTO inspecciones(id_intento,realizada_at,tiene_lesiones,presenta_sintomas,area,observaciones) VALUES
(@intento1,TIMESTAMP(@hoy,'08:13:00'),0,0,'GENERAL','Sin novedades; registro demo'),(@intento2,TIMESTAMP(@hoy,'08:26:00'),0,0,'GENERAL','Sin novedades; registro demo');
SET @inspeccion1=(SELECT id_inspeccion FROM inspecciones WHERE id_intento=@intento1);
INSERT INTO asistencias(id_menor,id_intento,fecha,ingreso_at) VALUES (@menor1,@intento1,@hoy,TIMESTAMP(@hoy,'08:12:00')),(@menor2,@intento2,@hoy,TIMESTAMP(@hoy,'08:25:00'));
SET @asistencia1=(SELECT id_asistencia FROM asistencias WHERE id_intento=@intento1);
SET @asistencia2=(SELECT id_asistencia FROM asistencias WHERE id_intento=@intento2);
INSERT INTO lesiones(id_inspeccion,ubicacion,descripcion,causa_reportada,estado) VALUES (@inspeccion1,'Rodilla derecha','Marca leve cicatrizada (caso ficticio)','Ejemplo para mostrar historial','RESUELTA');
INSERT INTO actividades_aula(id_grupo,fecha,titulo,descripcion,id_educadora) VALUES (@grupo1,@hoy,'Exploramos colores','Clasificación de bloques por color. Actividad ficticia.',@educadora);
SET @actividad=LAST_INSERT_ID();
INSERT INTO participaciones_actividad(id_actividad,id_asistencia,observaciones) VALUES (@actividad,@asistencia1,'Participó en la actividad demo'),(@actividad,@asistencia2,'Completó la actividad demo');
INSERT INTO atenciones_enfermeria(id_menor,id_asistencia,id_usuario,atendido_at,motivo,acciones,requiere_recoleccion) VALUES (@menor1,@asistencia1,@enfermeria,TIMESTAMP(@hoy,'10:15:00'),'Revisión preventiva de demostración','Descanso breve e hidratación; sin indicación adicional.',0);
SET @atencion=LAST_INSERT_ID();
INSERT INTO mediciones(id_menor,id_atencion,id_usuario,fecha,peso_kg,talla_cm,tipo) VALUES (@menor1,@atencion,@enfermeria,@hoy,14.200,94.50,'INCIDENTE');
INSERT INTO alertas_recoleccion(id_atencion,motivo,estado) VALUES (@atencion,'Alerta ficticia para mostrar el flujo de contacto familiar','PENDIENTE');
INSERT INTO recetas(id_menor,nombre_medico,cedula_profesional,fecha_consulta,vigencia_inicio,vigencia_fin,permite_convivencia,diagnostico,ruta_documento,verificada_por,verificada_at) VALUES (@menor2,'Dra. Ejemplo Demo','FICTICIA-0000',@hoy,@hoy,DATE_ADD(@hoy,INTERVAL 7 DAY),1,'Registro médico simulado','demo/receta-ficticia.pdf',@enfermeria,NOW());
SET @receta=LAST_INSERT_ID();
INSERT INTO restricciones_alimentarias(id_menor,id_receta,tipo,descripcion,inicio,fin,activa,revision_comedor) VALUES (@menor2,@receta,'DIETA_MEDICA_TEMPORAL','Ejemplo simulado: evitar cítricos por siete días',@hoy,DATE_ADD(@hoy,INTERVAL 7 DAY),1,JSON_OBJECT('revisado',true,'demo',true));
INSERT INTO tratamientos(id_receta,medicamento,dosis,unidad,via,fecha_inicio,fecha_fin,dosificador_requerido,dosificador_entregado,indicaciones) VALUES (@receta,'Solución salina (caso ficticio)',2.000,'ml','ORAL',@hoy,DATE_ADD(@hoy,INTERVAL 2 DAY),1,1,'Registro demo; no es una instrucción médica.');
SET @tratamiento=LAST_INSERT_ID();
INSERT INTO horarios_tratamiento(id_tratamiento,hora) VALUES (@tratamiento,'12:00:00');
SET @horario=LAST_INSERT_ID();
INSERT INTO administraciones_medicamento(id_horario,fecha_programada,estado) VALUES (@horario,@hoy,'PENDIENTE');
INSERT INTO ingredientes_comedor(nombre,registrado_por) VALUES ('Arroz integral (demo)',@educadora),('Calabacita (demo)',@educadora),('Manzana (demo)',@educadora);
INSERT INTO platillos_comedor(nombre,ingredientes,registrado_por) VALUES ('Arroz con verduras (demo)',JSON_ARRAY('Arroz integral','Calabacita'),@educadora),('Fruta de temporada (demo)',JSON_ARRAY('Manzana'),@educadora);
SET @platillo=(SELECT id_platillo FROM platillos_comedor WHERE nombre='Arroz con verduras (demo)' ORDER BY id_platillo DESC LIMIT 1);
INSERT INTO registros_alimentacion(id_asistencia,tipo_comida,racion,observaciones,id_usuario,id_platillo,comprobacion) VALUES (@asistencia1,'Comida','COMPLETA','Aceptó la comida del día (demo)',@educadora,@platillo,JSON_OBJECT('demo',true)),(@asistencia2,'Colación','TRES_CUARTOS','Registro de colación (demo)',@educadora,@platillo,JSON_OBJECT('demo',true));
INSERT INTO traslados_comedor(id_asistencia,entrada_at,salida_at,id_responsable) VALUES (@asistencia1,TIMESTAMP(@hoy,'12:00:00'),TIMESTAMP(@hoy,'12:35:00'),@educadora),(@asistencia2,TIMESTAMP(@hoy,'12:02:00'),TIMESTAMP(@hoy,'12:36:00'),@educadora);
INSERT INTO cuotas(id_menor,periodo_inicio,periodo_fin,vencimiento,importe,estado) VALUES (@menor1,DATE_FORMAT(@hoy,'%Y-%m-01'),LAST_DAY(@hoy),DATE_ADD(@hoy,INTERVAL 5 DAY),1850.00,'PENDIENTE'),(@menor2,DATE_FORMAT(@hoy,'%Y-%m-01'),LAST_DAY(@hoy),DATE_ADD(@hoy,INTERVAL 5 DAY),1850.00,'PENDIENTE');
SET @cuota1=(SELECT id_cuota FROM cuotas WHERE id_menor=@menor1 ORDER BY id_cuota DESC LIMIT 1);
SET @cuota2=(SELECT id_cuota FROM cuotas WHERE id_menor=@menor2 ORDER BY id_cuota DESC LIMIT 1);
INSERT INTO pagos(id_cuota,importe,pagado_at,metodo,referencia,id_usuario,estado,comprobante) VALUES (@cuota2,1850.00,NOW(),'TRANSFERENCIA','DEMO-TRX-2026-002',@admin,'REGISTRADO',JSON_OBJECT('demo',true,'folio','DEMO-TRX-2026-002'));
INSERT INTO prorrogas(id_cuota,nueva_fecha,motivo,id_usuario) VALUES (@cuota1,DATE_ADD(@hoy,INTERVAL 10 DAY),'Solicitud ficticia de apoyo familiar',@admin);
INSERT INTO retardos(id_asistencia,id_persona,aviso_at,justificacion,estado,anio) VALUES (@asistencia2,@persona3,TIMESTAMP(@hoy,'08:25:00'),'Ejemplo de registro de puntualidad (demo)','PENDIENTE',YEAR(@hoy));
INSERT INTO entregas(id_asistencia,id_vinculo,id_gafete,nombre_portador_gafete,identidad_verificada,metodo_verificacion,confirmacion,evidencia_confirmacion,entregado_at,id_usuario,resumen_diario,identidad_receptor) VALUES
(@asistencia1,@vinculo1,@gafete1,'Mariana López (familia demo)',1,'CHECK',1,'Confirmación ficticia de demostración',TIMESTAMP(@hoy,'15:20:00'),@recepcion,JSON_OBJECT('alimentacion','completa','demo',true),JSON_OBJECT('nombre','Mariana López (familia demo)','demo',true)),
(@asistencia2,@vinculo2,@gafete2,'Elena Cruz (familia demo)',1,'CHECK',1,'Confirmación ficticia de demostración',TIMESTAMP(@hoy,'15:25:00'),@recepcion,JSON_OBJECT('alimentacion','colación','demo',true),JSON_OBJECT('nombre','Elena Cruz (familia demo)','demo',true));
INSERT INTO reportes_autoridad(id_asistencia,tipo,estado,id_usuario,contenido) VALUES (@asistencia2,'OTRO','GENERADO',@admin,JSON_OBJECT('demo',true,'detalle','Reporte de ejemplo sin evento real'));
COMMIT;
