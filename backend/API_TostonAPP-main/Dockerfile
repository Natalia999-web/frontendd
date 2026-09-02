# Imagen base ligera de Python
FROM python:3.11-slim

# Carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero solo requirements.txt para aprovechar el cache de Docker
# (si no cambian las dependencias, no se reinstalan en cada build)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ahora copiamos el resto del código
COPY . .

# Puerto que expone la API dentro del contenedor
EXPOSE 8000

# Comando de arranque (sin --reload, eso es solo para desarrollo local)
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]