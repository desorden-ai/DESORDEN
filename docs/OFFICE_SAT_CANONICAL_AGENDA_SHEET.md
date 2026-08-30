# DESORDEN SAT — Google Sheet canónico y pestañas por operario

## Decisión canónica

Todo el sistema de oficina y operarios gira alrededor del mismo Google Spreadsheet que ya contiene `AGENDA_PANASONIC`.

No se crea un Spreadsheet por operario, una agenda paralela ni una base de datos funcional separada para planificación.

`AGENDA_PANASONIC` permanece como fuente maestra de planificación.

La API SAT y el dashboard `/lab` son las únicas capas que deben exponer los datos a los usuarios finales.

## Restricción importante de Google Sheets

Google Sheets no ofrece permisos de lectura/escritura realmente aislados por pestaña dentro de un mismo Spreadsheet.

Por tanto:

- no se comparte el Spreadsheet directamente con los operarios;
- proteger u ocultar una pestaña no se considera una frontera de seguridad;
- cada operario accede mediante DESORDEN SAT;
- la API obtiene el `operatorId` de la sesión y solo devuelve los datos autorizados;
- la secretaria, mediante `/lab`, dispone de permisos de oficina para ver y editar todos los operarios.

Así se consigue el comportamiento solicitado de «cada usuario solo ve su pestaña» sin exponer el resto del Spreadsheet.

## Pestañas del mismo Spreadsheet

### `AGENDA_PANASONIC`

Fuente maestra de trabajos planificados.

Debe conservar los campos actuales y añadir, si todavía no existe, un identificador estable de operario:

- `OPERATOR_ID`

Opcionalmente puede conservar también un campo de presentación:

- `OPERARIO`

La relación real debe hacerse siempre por `OPERATOR_ID`, no por nombre.

### `OPERARIOS`

Registro administrativo de operarios gestionado por oficina.

Columnas recomendadas:

- `OPERATOR_ID`
- `NOMBRE`
- `USERNAME`
- `TELEFONO`
- `ROLE`
- `STATUS`
- `PHOTO_URL`
- `SHEET_TAB`
- `CREATED_AT`
- `UPDATED_AT`
- `PASSWORD_VERSION`

No guardar nunca:

- contraseña en texto plano;
- password hash si el Spreadsheet es accesible desde cliente;
- tokens de sesión;
- secretos de servidor.

El hash de contraseña y las sesiones deben permanecer en almacenamiento de servidor adecuado. El Sheet puede conservar únicamente metadatos administrativos no sensibles.

### `FICHAJES`

Registro consolidado y auditable de fichajes.

Cada evento incluye:

- `OPERATOR_ID`
- `EVENT_ID`
- `TYPE`
- `TIMESTAMP`
- `LOCAL_DATE`
- `LOCAL_TIME`
- `TIMEZONE`
- `CREATED_AT`

El dashboard puede filtrar por operario.

### `FOTOS_OFICINA`

Metadatos de fotos enviadas a oficina.

Campos mínimos:

- `PHOTO_ID`
- `OPERATOR_ID`
- `SA`
- `ORDER_ID`
- `FILE_URL` o referencia Drive
- `NOTE`
- `CREATED_AT`

Los binarios de imagen no deben almacenarse en celdas del Sheet; usar Drive u otro almacenamiento existente y guardar únicamente la referencia.

## Pestañas visibles por operario

Al crear un operario desde `/lab`, Apps Script crea también una pestaña de trabajo dentro del MISMO Spreadsheet.

Nombre de presentación sugerido:

`AGENDA_<USERNAME>`

Ejemplos:

- `AGENDA_DAVID`
- `AGENDA_JUAN`
- `AGENDA_MARC`

`OPERARIOS.SHEET_TAB` guarda el nombre de esa pestaña.

La pestaña es una vista/materialización de las filas de `AGENDA_PANASONIC` cuyo `OPERATOR_ID` corresponde al operario.

Nunca se debe utilizar el nombre de la pestaña como identidad. El vínculo sigue siendo `OPERATOR_ID`.

## Escritura y sincronización

Para evitar dos fuentes de verdad:

- `AGENDA_PANASONIC` es la fuente maestra;
- las pestañas `AGENDA_<USERNAME>` son vistas por operario;
- las escrituras desde `/lab` o SAT se procesan por API/Apps Script y terminan en `AGENDA_PANASONIC`;
- después se refresca la pestaña materializada correspondiente;
- una edición realizada por la secretaria desde el dashboard debe usar la misma API y no escribir dos veces en dos pestañas diferentes.

Si se permite edición manual directamente dentro de una pestaña `AGENDA_<USERNAME>`, Apps Script debe interceptar/normalizar el cambio y aplicarlo a `AGENDA_PANASONIC` usando una clave estable (`CALENDAR_EVENT_ID`, `SA` más identificador de fila, o un `AGENDA_ID`). No usar números de fila como identidad permanente.

## Acceso del operario

El operario nunca recibe acceso directo al Spreadsheet.

Flujo:

```text
DESORDEN SAT
  -> login username + password
  -> sesión contiene operatorId
  -> GET agenda
  -> servidor filtra por operatorId
  -> devuelve únicamente su agenda
```

Aunque existan físicamente otras pestañas en el Spreadsheet, el operario no puede solicitarlas ni cambiar `operatorId` desde la APK.

## Acceso de oficina

`/lab` puede mostrar:

```text
TODOS | DAVID | JUAN | MARC | ...
```

- `TODOS` consulta `AGENDA_PANASONIC` sin filtro de operario para rol oficina.
- cada pestaña de nombre aplica filtro por `OPERATOR_ID`.
- al crear/modificar un trabajo, la secretaria asigna el operario.
- al crear un operario, se crea su registro en `OPERARIOS` y su pestaña `AGENDA_<USERNAME>`.
- al desactivar un operario no se elimina su pestaña ni su histórico.

## Perfil y cuenta

La oficina es la autoridad administrativa.

La secretaria puede modificar:

- nombre;
- username;
- teléfono;
- estado;
- contraseña mediante reset;
- asignación de agenda.

El instalador solo puede modificar su foto de perfil.

Los cambios de nombre no deben romper la agenda porque todas las relaciones dependen de `OPERATOR_ID`.

Si cambia `USERNAME`, la pestaña física puede renombrarse opcionalmente, actualizando `OPERARIOS.SHEET_TAB`, pero el `OPERATOR_ID` nunca cambia.

## Regla de seguridad

«Cada usuario tiene acceso a su pestaña» significa acceso lógico mediante API/SAT, no un permiso directo de Google Sheets.

La frontera de autorización es:

`sesión -> operatorId -> filtro de servidor`.

Esto permite mantener un único Spreadsheet Panasonic, múltiples pestañas operativas y aislamiento real entre operarios.
