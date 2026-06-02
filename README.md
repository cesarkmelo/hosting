# AlfamediaWEB Hosting Manager

App React/Vite con backend Express para administrar vencimientos de hosting, clientes, pagos y recordatorios por correo.

## Requisitos

- Node.js 18 o superior.
- NPM.
- Archivo `.env` local basado en `.env.example`.

## Variables de entorno

`VITE_GOOGLE_CLIENT_ID` es obligatoria para mostrar el botón de acceso con Google.

Importante: las variables `VITE_*` se incrustan durante `npm run build`. Si se cambia `VITE_GOOGLE_CLIENT_ID` en producción, hay que recompilar y volver a subir `dist/`.

```bash
cp .env.example .env
```

## Desarrollo local

```bash
npm install
npm run dev
```

## Verificación

```bash
npm run lint
npm run build
```

## Producción actual

- Dominio: `https://hosting.alfamediaweb.com`
- VPS: Plesk
- Ruta: `/var/www/vhosts/alfamediaweb.com/hosting.alfamediaweb.com/app-directory`
- Entrada compilada: `dist/index.html`
- Backend compilado: `dist/server.cjs`
- Base de datos JSON: `data/database.json`

El archivo `.env` de producción debe existir en la carpeta `app-directory` y nunca debe versionarse.

## Flujo de deploy recomendado con Git

1. Editar y probar siempre en local.
2. Ejecutar `npm run lint` y `npm run build`.
3. Hacer commit y push al repositorio remoto.
4. En el VPS, dentro de `app-directory`, hacer `git pull`.
5. Ejecutar `npm install` solo cuando cambie `package-lock.json`.
6. Ejecutar `npm run build` en el VPS si el repositorio incluye fuentes completas.
7. Reiniciar la app tocando `tmp/restart.txt`:

```bash
touch tmp/restart.txt
```

Mientras el VPS no tenga las fuentes completas, el deploy operativo es compilar localmente y subir `dist/`, preservando `data/database.json` y `.env`.

## Regla de seguridad

No subir a Git:

- `.env`
- `.env.*`
- `.local-secrets/`
- `node_modules/`
- `dist/`, salvo que se decida explícitamente versionar builds para este hosting.
