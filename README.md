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

## Flujo simple de actualizacion

Este es el flujo normal para actualizar la app sin romper produccion.

### 1. Cambiar en local

Editar archivos en el Mac, dentro de este proyecto.

No editar directamente archivos de produccion en el VPS salvo emergencia.

### 2. Probar en local

```bash
npm install
npm run lint
npm run build
```

Si `npm run build` falla, no subir al VPS.

### 3. Guardar cambios en Git

```bash
git status
git add .
git commit -m "Descripcion corta del cambio"
git push
```

Antes de hacer commit, confirmar que Git no esta incluyendo `.env`, `data/database.json`, `dist/`, `node_modules/` ni `.local-secrets/`.

### 4. Actualizar el VPS

Entrar al VPS y moverse a la carpeta de la app:

```bash
cd /var/www/vhosts/alfamediaweb.com/hosting.alfamediaweb.com/app-directory
git pull
npm install
npm run build
touch tmp/restart.txt
```

`touch tmp/restart.txt` le pide a Passenger/Plesk que reinicie la app Node.

### 5. Verificar

Abrir:

```text
https://hosting.alfamediaweb.com
```

Tambien se puede verificar que el backend responde:

```bash
curl https://hosting.alfamediaweb.com/api/data
```

La respuesta esperada sin iniciar sesion es `401 Acceso no autorizado`. Eso significa que Express esta activo y protegiendo la API.

## Explicacion basica

- **Local**: carpeta del Mac donde se editan archivos y se prueban cambios.
- **GitHub**: copia central del codigo. El repo es `cesarkmelo/hosting`.
- **VPS**: servidor donde vive la app real.
- **Pull**: traer al VPS los ultimos cambios desde GitHub.
- **Build**: generar la carpeta `dist/`, que es lo que el navegador carga.
- **Restart**: reiniciar la app para que use el codigo nuevo.
- **`.env`**: archivo privado con variables de produccion. No se sube a Git.
- **`data/database.json`**: base de datos local de clientes. No se sube a Git.

## Regla importante de Vite

`VITE_GOOGLE_CLIENT_ID` se usa en el navegador y queda grabada dentro de `dist/` durante el build.

Si se cambia `VITE_GOOGLE_CLIENT_ID` en `.env`, hay que ejecutar otra vez:

```bash
npm run build
touch tmp/restart.txt
```

Solo cambiar `.env` no actualiza el JavaScript que ya fue compilado.

## Regla de seguridad

No subir a Git:

- `.env`
- `.env.*`
- `.local-secrets/`
- `node_modules/`
- `dist/`, salvo que se decida explícitamente versionar builds para este hosting.
