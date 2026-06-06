"""
Mantém o Supabase acordado fazendo um SELECT simples.
Executado automaticamente toda segunda-feira pelo GitHub Actions.
"""
import os
import psycopg2

url = os.environ.get("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL não definida")

conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM prova")
count = cur.fetchone()[0]
conn.close()
print(f"✅ Supabase acordado. Provas no banco: {count}")
