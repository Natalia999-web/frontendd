# TostonApp

## Descripción del proyecto

TostonApp es una aplicación full stack para gestión de producción y ventas, compuesta por un backend tipo API y un frontend web, dockerizados para poder ejecutarse de forma reproducible en cualquier equipo con Docker instalado.

## Tecnologías utilizadas

- **Backend:** Python + FastAPI, servido con Uvicorn
- **Base de datos:** MySQL, alojada en Aiven.io (en la nube, no dockerizada)
- **Frontend:** React + Vite, compilado y servido en producción con Nginx
- **Orquestación:** Docker Compose

## Arquitectura de la aplicación

```
React (Docker)  →  FastAPI (Docker)  →  MySQL (Aiven, nube)
   :5173               :8000
```

El frontend y el backend corren en contenedores separados, expuestos en puertos distintos. La base de datos permanece externa, en Aiven, y el backend se conecta a ella por internet usando variables de entorno.

## Variables de entorno necesarias

El backend requiere un archivo `.env` en `backend/API_TostonAPP-main/.env` (no incluido en el repositorio por seguridad). Usa `.env.example` como plantilla:

```
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
DB_NAME=
SECRET_KEY=
```

Copia la plantilla y completa los valores reales antes de levantar el proyecto:

```
copy backend\API_TostonAPP-main\.env.example backend\API_TostonAPP-main\.env
```

**No subir nunca credenciales reales al repositorio.**

## Cómo construir la aplicación

Desde la raíz del proyecto (donde está `docker-compose.yml`):

```
docker compose build
```

## Cómo ejecutarla con Docker Compose

```
docker compose up --build
```

- Backend disponible en: `http://localhost:8000/docs` (documentación interactiva Swagger)
- Frontend disponible en: `http://localhost:5173`

## Cómo detener los contenedores

```
docker compose down
```

## Cómo consultar los logs

```
docker compose logs backend
docker compose logs frontend
```

O en tiempo real:

```
docker compose logs -f
```
