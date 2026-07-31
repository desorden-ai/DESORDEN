# DESORDEN — Requisitos de despliegue

La publicación automática requiere dos secretos de GitHub Actions:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

El token debe tener acceso restringido a la cuenta y zona correctas, con permisos para editar Workers Scripts y Workers Routes sobre `desorden.cat`.

La ruta de producción definida en `wrangler.jsonc` es:

```text
www.desorden.cat/*
```

El workflow ejecuta pruebas, valida la autenticación, despliega y comprueba que producción contiene `SI NO ET VEUEN` y las cinco secciones.
