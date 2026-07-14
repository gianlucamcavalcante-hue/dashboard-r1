import time
import psycopg2
import psycopg2.extras
import psycopg2.pool
import streamlit as st
from contextlib import contextmanager
from typing import Optional

# ---------- conexão ----------

def _get_url():
    try:
        return st.secrets["DATABASE_URL"]
    except Exception:
        import os
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL não encontrada.")
        return url


# Pool persistente — reutiliza conexões entre reruns do Streamlit
_pool: Optional[psycopg2.pool.SimpleConnectionPool] = None


def _new_pool():
    return psycopg2.pool.SimpleConnectionPool(
        1, 5,  # min 1, max 5 conexões simultâneas
        _get_url(),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=10,          # não trava esperando um banco frio
        keepalives=1, keepalives_idle=30,
        keepalives_interval=10, keepalives_count=3,
    )


def _reset_pool():
    global _pool
    try:
        if _pool is not None:
            _pool.closeall()
    except Exception:
        pass
    _pool = None


def _get_pool():
    """Cria/retorna o pool, tentando algumas vezes (banco pode estar 'acordando')."""
    global _pool
    if _pool is None or _pool.closed:
        ultimo = None
        for tentativa in range(3):
            try:
                _pool = _new_pool()
                return _pool
            except Exception as e:
                ultimo = e
                time.sleep(1.5 * (tentativa + 1))
        raise ultimo
    return _pool


@contextmanager
def get_conn():
    try:
        pool = _get_pool()
        conn = pool.getconn()
    except Exception:
        # conexão do pool pode ter expirado (app dormiu) — recria e tenta 1x
        _reset_pool()
        pool = _get_pool()
        conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            pool.putconn(conn)  # devolve ao pool (não fecha)
        except Exception:
            pass


def _run(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur


# ---------- constantes ----------

AREAS = ["Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia", "Obstetrícia", "Preventiva"]

# Se respondi ou não a área. O percentual é calculado a partir de acertos/total.
# "Estudar os erros" é um marcador à parte (coluna estudada), não afeta o cálculo.
STATUS_FIZ = "feita"
STATUS_NAO_FIZ = "nao_fiz"

STATUS_LABEL = {
    STATUS_FIZ: "Fiz",
    STATUS_NAO_FIZ: "Não fiz",
}


# ---------- init ----------

@st.cache_resource
def init_db():
    with get_conn() as conn:
        _run(conn, """
            CREATE TABLE IF NOT EXISTS prova (
                id             SERIAL PRIMARY KEY,
                banca          TEXT NOT NULL,
                ano            INTEGER NOT NULL,
                data_feita     DATE,
                total_questoes INTEGER NOT NULL DEFAULT 0,
                acertos        INTEGER NOT NULL DEFAULT 0
            )
        """)
        # coluna de correção da prova inteira (adicionada para bancos já existentes)
        _run(conn, "ALTER TABLE prova ADD COLUMN IF NOT EXISTS corrigida BOOLEAN DEFAULT FALSE")

        _run(conn, """
            CREATE TABLE IF NOT EXISTS desempenho_area (
                id       SERIAL PRIMARY KEY,
                prova_id INTEGER NOT NULL REFERENCES prova(id) ON DELETE CASCADE,
                area     TEXT NOT NULL,
                acertos  INTEGER NOT NULL DEFAULT 0,
                total    INTEGER NOT NULL DEFAULT 0
            )
        """)
        # status (fiz/não fiz) e se os erros já foram estudados
        _run(conn, "ALTER TABLE desempenho_area ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'feita'")
        _run(conn, "ALTER TABLE desempenho_area ADD COLUMN IF NOT EXISTS estudada BOOLEAN DEFAULT FALSE")
        # migra modelo antigo: 'corrigida' = fiz e estudei; 'pendente' = fiz (sem nota)
        _run(conn, "UPDATE desempenho_area SET estudada = TRUE WHERE status = 'corrigida'")
        _run(conn, "UPDATE desempenho_area SET status = 'feita' WHERE status IN ('corrigida', 'pendente')")
        # recalcula os totais de todas as provas a partir das áreas feitas
        _run(conn, """
            UPDATE prova p SET
                total_questoes = COALESCE((SELECT SUM(total) FROM desempenho_area d
                                           WHERE d.prova_id = p.id AND d.status = 'feita'), 0),
                acertos        = COALESCE((SELECT SUM(acertos) FROM desempenho_area d
                                           WHERE d.prova_id = p.id AND d.status = 'feita'), 0)
        """)

        _run(conn, """
            CREATE TABLE IF NOT EXISTS config (
                chave TEXT PRIMARY KEY,
                valor TEXT
            )
        """)
        _run(conn, """
            INSERT INTO config (chave, valor)
            VALUES ('meta_percentual', '70')
            ON CONFLICT (chave) DO NOTHING
        """)


def _recalcular_prova(conn, prova_id):
    """Atualiza total_questoes/acertos da prova como a soma das áreas que fiz (com nota)."""
    _run(conn, """
        UPDATE prova SET
            total_questoes = COALESCE((SELECT SUM(total) FROM desempenho_area
                                       WHERE prova_id = %s AND status = 'feita'), 0),
            acertos        = COALESCE((SELECT SUM(acertos) FROM desempenho_area
                                       WHERE prova_id = %s AND status = 'feita'), 0)
        WHERE id = %s
    """, (prova_id, prova_id, prova_id))


# ---------- config ----------

@st.cache_data(ttl=300)
def get_config(chave: str, default=None):
    with get_conn() as conn:
        cur = _run(conn, "SELECT valor FROM config WHERE chave = %s", (chave,))
        row = cur.fetchone()
        return row["valor"] if row else default


def set_config(chave: str, valor):
    with get_conn() as conn:
        _run(conn,
             "INSERT INTO config (chave, valor) VALUES (%s, %s) "
             "ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor",
             (chave, str(valor)))
    st.cache_data.clear()


# ---------- provas ----------

@st.cache_data(ttl=300)
def listar_provas():
    with get_conn() as conn:
        cur = _run(conn, "SELECT * FROM prova ORDER BY data_feita DESC, id DESC")
        return [dict(r) for r in cur.fetchall()]


def inserir_prova(banca, ano, data_feita, areas):
    """Cria uma prova e suas áreas.

    areas: lista de dicts {"area", "status", "acertos", "total", "estudada"}.
    Os totais da prova são derivados das áreas que fiz.
    """
    with get_conn() as conn:
        cur = _run(conn,
            "INSERT INTO prova (banca, ano, data_feita, total_questoes, acertos) "
            "VALUES (%s, %s, %s, 0, 0) RETURNING id",
            (banca, ano, data_feita))
        pid = cur.fetchone()["id"]
        for a in areas:
            _run(conn,
                 "INSERT INTO desempenho_area (prova_id, area, status, acertos, total, estudada) "
                 "VALUES (%s, %s, %s, %s, %s, %s)",
                 (pid, a["area"], a["status"], a.get("acertos", 0), a.get("total", 0),
                  a.get("estudada", False)))
        _recalcular_prova(conn, pid)
    st.cache_data.clear()
    return pid


def deletar_prova(prova_id: int):
    with get_conn() as conn:
        _run(conn, "DELETE FROM prova WHERE id = %s", (prova_id,))
    st.cache_data.clear()


# ---------- desempenho por área ----------

def atualizar_areas(prova_id, areas):
    """Atualiza (upsert) várias áreas de uma prova numa única transação.

    areas: lista de dicts {"area", "status", "acertos", "total", "estudada"}.
    """
    with get_conn() as conn:
        for a in areas:
            cur = _run(conn,
                "UPDATE desempenho_area SET status = %s, acertos = %s, total = %s, estudada = %s "
                "WHERE prova_id = %s AND area = %s",
                (a["status"], a.get("acertos", 0), a.get("total", 0),
                 a.get("estudada", False), prova_id, a["area"]))
            if cur.rowcount == 0:
                _run(conn,
                     "INSERT INTO desempenho_area (prova_id, area, status, acertos, total, estudada) "
                     "VALUES (%s, %s, %s, %s, %s, %s)",
                     (prova_id, a["area"], a["status"], a.get("acertos", 0), a.get("total", 0),
                      a.get("estudada", False)))
        _recalcular_prova(conn, prova_id)
    st.cache_data.clear()


@st.cache_data(ttl=300)
def listar_desempenho_area(prova_id=None):
    with get_conn() as conn:
        if prova_id:
            cur = _run(conn,
                       "SELECT * FROM desempenho_area WHERE prova_id = %s", (prova_id,))
        else:
            cur = _run(conn, "SELECT * FROM desempenho_area")
        return [dict(r) for r in cur.fetchall()]
