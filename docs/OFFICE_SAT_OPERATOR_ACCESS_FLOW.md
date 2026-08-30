# DESORDEN SAT — flujo de acceso gestionado desde oficina

## Regla funcional

La oficina es la autoridad de las cuentas de operario.

- No se usa Google Sign-In ni una cuenta Google como identidad del operario.
- No existe registro libre desde la APK.
- La secretaria crea el operario desde `/lab`.
- La secretaria asigna `username` y contraseña inicial.
- La secretaria puede editar nombre, usuario, teléfono, estado de acceso y sustituir la contraseña.
- La contraseña nunca se devuelve ni se almacena en texto plano; el backend conserva únicamente un hash seguro.
- El operario inicia sesión en DESORDEN SAT con `username + password`.
- Si el operario está desactivado, la sesión debe quedar invalidada y no puede volver a entrar.

## Perfil del operario en la APK

Los datos administrativos del perfil son de solo lectura para el operario:

- nombre;
- username;
- teléfono;
- rol;
- estado;
- otros datos definidos por oficina.

El único campo de perfil que puede modificar el propio operario es:

- `photo`.

Esta restricción debe aplicarse también en backend. Ocultar inputs en la APK no es suficiente.

La restricción `photo-only` se refiere al perfil/cuenta. El operario mantiene las funciones SAT de campo que correspondan a su rol y a las órdenes asignadas.

## Identificador

Cada operario tiene un `operatorId` inmutable generado por backend.

No usar el nombre, username ni correo como clave primaria.

`operatorId` relaciona:

- cuenta;
- agenda;
- órdenes asignadas;
- fichajes;
- fotos enviadas a oficina;
- sesiones;
- auditoría.

## Contrato mínimo de la web de oficina

Base visual web: `/lab/api`.

### Operarios

`GET /lab/api/operators`

Devuelve perfiles administrativos sin password/hash.

`POST /lab/api/operators`

```json
{
  "name": "David Milla",
  "username": "david",
  "phone": "",
  "password": "********",
  "role": "installer",
  "selfEditableFields": ["photo"]
}
```

`PUT /lab/api/operators/:operatorId`

Permite a oficina modificar datos administrativos. Nunca acepta hash enviado por frontend.

`PUT /lab/api/operators/:operatorId/password`

```json
{
  "password": "********"
}
```

El backend genera un hash nuevo e invalida las sesiones previas si la política de seguridad lo requiere.

`PUT /lab/api/operators/:operatorId/status`

```json
{
  "status": "active"
}
```

Estados mínimos: `active`, `disabled`.

### Agenda compartida

`GET /lab/api/agenda?operatorId=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD`

`POST /lab/api/agenda`

`PUT /lab/api/agenda`

Cada trabajo debe conservar `operatorId`.

La oficina puede crear y modificar trabajos. La APK consume los trabajos correspondientes a la sesión autenticada del operario.

### Fichajes

`GET /lab/api/clock?operatorId=<id>&period=today|week|month`

Los fichajes deben quedar relacionados con `operatorId` y almacenados en backend auditable; no depender de `localStorage` para el sistema final.

### Fotos de oficina

`GET /lab/api/photos?operatorId=<id>`

Las fotos enviadas desde SAT deben incluir `operatorId` y, cuando exista, `SA`/identificador de orden.

## Contrato mínimo de autenticación SAT

API canónica: `https://sat-api.desorden.cat`.

Los nombres exactos de endpoint pueden adaptarse a las rutas reales ya existentes, pero debe existir el equivalente funcional a:

`POST /api/auth/operator/login`

Entrada:

```json
{
  "username": "david",
  "password": "********"
}
```

Respuesta:

```json
{
  "sessionToken": "opaque-or-signed-token",
  "operator": {
    "operatorId": "op_xxx",
    "name": "David Milla",
    "username": "david",
    "phone": "",
    "role": "installer",
    "photoUrl": "",
    "selfEditableFields": ["photo"]
  }
}
```

La APK guarda el token en almacenamiento seguro nativo, nunca la contraseña.

`GET /api/auth/operator/me`

Devuelve el perfil de la sesión activa.

`POST /api/auth/operator/logout`

Invalida la sesión/token según la implementación elegida.

`PUT /api/auth/operator/me/photo`

Única escritura de perfil permitida al rol `installer`.

Cualquier intento del operario de modificar nombre, username, teléfono, rol, estado o contraseña debe devolver `403`.

## Permisos

### Oficina / secretaria

Puede:

- crear operarios;
- editar datos;
- resetear contraseña;
- activar/desactivar acceso;
- asignar agenda;
- crear/modificar trabajos;
- consultar fichajes;
- consultar fotos.

### Operario / instalador

En su cuenta puede:

- iniciar/cerrar sesión;
- consultar sus datos;
- subir/cambiar su foto.

No puede desde su perfil:

- cambiar nombre;
- cambiar username;
- cambiar contraseña;
- cambiar teléfono;
- cambiar rol;
- activar/desactivar su cuenta;
- cambiar de `operatorId`.

Sus permisos operativos SAT (órdenes, fotos de trabajo, firma, fichaje, etc.) continúan siendo los definidos por la aplicación y no deben confundirse con los permisos de edición del perfil.

## Seguridad obligatoria

- Password hash de servidor con Argon2id, scrypt o bcrypt con coste adecuado.
- Nunca guardar contraseñas en Git, JS, HTML, Sheets, logs o localStorage.
- Rate limiting en login.
- Respuesta de login genérica ante usuario/contraseña incorrectos.
- HTTPS únicamente.
- Tokens revocables o con expiración razonable.
- `operatorId` obtenido desde sesión para las escrituras del operario; no confiar en un `operatorId` arbitrario enviado por la APK.
- La oficina debe estar protegida por autenticación administrativa independiente.

## Flujo final

```text
OFICINA /lab
  → crea operario
  → asigna username + contraseña
  → asigna/modifica agenda y datos

OPERARIO / DESORDEN SAT
  → login username + contraseña
  → backend identifica operatorId
  → recibe su agenda/órdenes/datos
  → perfil administrativo read-only
  → solo puede cambiar su foto
  → fichajes/fotos se guardan asociados a operatorId

OFICINA /lab
  → ve agenda, fichajes y fotos del mismo operatorId
  → puede modificar datos y acceso
```
