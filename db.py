import psycopg2
import psycopg2.extras
from contextlib import contextmanager

# ---------- conexão ----------

def _get_url():
    """Lê a URL do banco: st.secrets em produção, variável de ambiente localmente."""
    try:
        import streamlit as st
        return st.secrets["DATABASE_URL"]
    except Exception:
        import os
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError(
                "DATABASE_URL não encontrada. "
                "Adicione em .streamlit/secrets.toml ou como variável de ambiente."
            )
        return url


@contextmanager
def get_conn():
    conn = psycopg2.connect(_get_url(), cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _run(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur


# ---------- constantes ----------

AREAS = ["Clínica Médica", "Cirurgia", "Pediatria", "GO", "Preventiva"]
TIPOS_ERRO = ["conhecimento", "interpretação", "desatenção", "chute", "pegadinha"]


# ---------- init ----------

def init_db():
    with get_conn() as conn:
        _run(conn, """
            CREATE TABLE IF NOT EXISTS prova (
                id             SERIAL PRIMARY KEY,
                banca          TEXT NOT NULL,
                ano            INTEGER NOT NULL,
                data_feita     DATE,
                total_questoes INTEGER NOT NULL,
                acertos        INTEGER NOT NULL
            )
        """)
        _run(conn, """
            CREATE TABLE IF NOT EXISTS desempenho_area (
                id       SERIAL PRIMARY KEY,
                prova_id INTEGER NOT NULL REFERENCES prova(id) ON DELETE CASCADE,
                area     TEXT NOT NULL,
                acertos  INTEGER NOT NULL,
                total    INTEGER NOT NULL
            )
        """)
        _run(conn, """
            CREATE TABLE IF NOT EXISTS erro (
                id             SERIAL PRIMARY KEY,
                prova_id       INTEGER REFERENCES prova(id) ON DELETE SET NULL,
                numero_questao INTEGER,
                area           TEXT,
                tema           TEXT,
                tipo_erro      TEXT,
                conceito       TEXT,
                resposta       TEXT,
                prioridade     INTEGER DEFAULT 1,
                card_feito     BOOLEAN DEFAULT FALSE
            )
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


# ---------- config ----------

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


# ---------- provas ----------

def listar_provas():
    with get_conn() as conn:
        cur = _run(conn, "SELECT * FROM prova ORDER BY data_feita DESC")
        return cur.fetchall()


def inserir_prova(banca, ano, data_feita, total_questoes, acertos):
    with get_conn() as conn:
        cur = _run(conn,
            "INSERT INTO prova (banca, ano, data_feita, total_questoes, acertos) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (banca, ano, data_feita, total_questoes, acertos))
        return cur.fetchone()["id"]


def deletar_prova(prova_id: int):
    with get_conn() as conn:
        _run(conn, "DELETE FROM prova WHERE id = %s", (prova_id,))


# ---------- desempenho por área ----------

def inserir_desempenho_area(prova_id, area, acertos, total):
    with get_conn() as conn:
        _run(conn,
             "INSERT INTO desempenho_area (prova_id, area, acertos, total) "
             "VALUES (%s, %s, %s, %s)",
             (prova_id, area, acertos, total))


def listar_desempenho_area(prova_id=None):
    with get_conn() as conn:
        if prova_id:
            cur = _run(conn,
                       "SELECT * FROM desempenho_area WHERE prova_id = %s", (prova_id,))
        else:
            cur = _run(conn, "SELECT * FROM desempenho_area")
        return cur.fetchall()


# ---------- erros ----------

def listar_erros(tipo_erro=None, area=None, card_feito=None):
    sql = ("SELECT e.*, p.banca, p.ano FROM erro e "
           "LEFT JOIN prova p ON e.prova_id = p.id WHERE 1=1")
    params = []
    if tipo_erro:
        sql += " AND e.tipo_erro = %s"
        params.append(tipo_erro)
    if area:
        sql += " AND e.area = %s"
        params.append(area)
    if card_feito is not None:
        sql += " AND e.card_feito = %s"
        params.append(card_feito)
    sql += " ORDER BY e.prioridade DESC, e.id DESC"
    with get_conn() as conn:
        cur = _run(conn, sql, params)
        return cur.fetchall()


def inserir_erro(prova_id, numero_questao, area, tema, tipo_erro,
                 conceito, resposta, prioridade):
    with get_conn() as conn:
        _run(conn,
             "INSERT INTO erro (prova_id, numero_questao, area, tema, tipo_erro, "
             "conceito, resposta, prioridade) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
             (prova_id, numero_questao, area, tema, tipo_erro,
              conceito, resposta, prioridade))


def marcar_card_feito(erro_id: int, feito: bool):
    with get_conn() as conn:
        _run(conn, "UPDATE erro SET card_feito = %s WHERE id = %s", (feito, erro_id))


def deletar_erro(erro_id: int):
    with get_conn() as conn:
        _run(conn, "DELETE FROM erro WHERE id = %s", (erro_id,))
