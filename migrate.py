"""
Migra dados do SQLite local para o Supabase.
Execute UMA vez depois de configurar o DATABASE_URL em .streamlit/secrets.toml.

Como usar:
  python3 migrate.py
"""
import sqlite3
from pathlib import Path
import db  # já usa Supabase

SQLITE_PATH = Path(__file__).parent / "data" / "r1.db"


def migrar():
    if not SQLITE_PATH.exists():
        print("Banco SQLite não encontrado. Nada a migrar.")
        return

    local = sqlite3.connect(SQLITE_PATH)
    local.row_factory = sqlite3.Row

    db.init_db()

    # --- provas ---
    provas = local.execute("SELECT * FROM prova").fetchall()
    id_map = {}  # old_id → new_id
    for p in provas:
        new_id = db.inserir_prova(
            p["banca"], p["ano"], p["data_feita"],
            p["total_questoes"], p["acertos"]
        )
        id_map[p["id"]] = new_id
    print(f"✅ {len(provas)} prova(s) migrada(s)")

    # --- desempenho por área ---
    areas = local.execute("SELECT * FROM desempenho_area").fetchall()
    for a in areas:
        new_prova_id = id_map.get(a["prova_id"])
        if new_prova_id:
            db.inserir_desempenho_area(new_prova_id, a["area"],
                                       a["acertos"], a["total"])
    print(f"✅ {len(areas)} registro(s) de área migrado(s)")

    # --- erros ---
    erros = local.execute("SELECT * FROM erro").fetchall()
    for e in erros:
        new_prova_id = id_map.get(e["prova_id"]) if e["prova_id"] else None
        db.inserir_erro(
            new_prova_id, e["numero_questao"], e["area"], e["tema"],
            e["tipo_erro"], e["conceito"], e["resposta"], e["prioridade"]
        )
    print(f"✅ {len(erros)} erro(s) migrado(s)")

    # --- config ---
    configs = local.execute("SELECT * FROM config").fetchall()
    for c in configs:
        db.set_config(c["chave"], c["valor"])
    print(f"✅ {len(configs)} configuração(ões) migrada(s)")

    local.close()
    print("\nMigração concluída! Seus dados estão no Supabase.")


if __name__ == "__main__":
    migrar()
