import os, time
from dotenv import load_dotenv
import pymysql

load_dotenv()

print("Intentando conectar a Aiven...")
t0 = time.time()
try:
    conn = pymysql.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        db=os.getenv("DB_NAME"),
        connect_timeout=10,
        ssl={"ssl": {}},
    )
    print(f"Conexión establecida en {time.time()-t0:.3f}s")

    cur = conn.cursor()

    cur.execute("SELECT 1")
    print(f"SELECT 1 OK en {time.time()-t0:.3f}s")

    cur.execute("SHOW STATUS LIKE 'Threads_connected'")
    row = cur.fetchone()
    print(f"Conexiones activas ahora: {row[1]}")

    cur.execute("SHOW VARIABLES LIKE 'max_connections'")
    row = cur.fetchone()
    print(f"Límite máximo de conexiones: {row[1]}")

    conn.close()
except Exception as e:
    print(f"FALLO en {time.time()-t0:.3f}s: {type(e).__name__}: {e}")
