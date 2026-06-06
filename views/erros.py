import streamlit as st
import pandas as pd
import db
import theme


def render():
    col_f1, col_f2, col_f3 = st.columns(3)
    tipo_sel = col_f1.selectbox("Tipo de erro", ["Todos"] + db.TIPOS_ERRO)
    area_sel = col_f2.selectbox("Área", ["Todas"] + db.AREAS)
    card_sel = col_f3.selectbox("Card Anki", ["Todos", "Feito", "Pendente"])

    tipo_filtro = None if tipo_sel == "Todos" else tipo_sel
    area_filtro = None if area_sel == "Todas" else area_sel
    card_filtro = None
    if card_sel == "Feito":
        card_filtro = True
    elif card_sel == "Pendente":
        card_filtro = False

    erros_raw = db.listar_erros(tipo_filtro, area_filtro, card_filtro)

    if erros_raw:
        df = pd.DataFrame([dict(r) for r in erros_raw])
        total = len(df)
        exec_mask = df["tipo_erro"].isin(["interpretação", "desatenção"])
        pct_exec = exec_mask.sum() / total * 100

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total de erros", total)
        c2.metric("Pendentes de card", int((df["card_feito"] == 0).sum()))
        c3.metric("Cards feitos", int((df["card_feito"] == 1).sum()))
        c4.metric("Erros de execução", f"{pct_exec:.0f}%", help="Interpretação + Desatenção")

        if pct_exec >= 50:
            theme.banner(
                f"<b>{pct_exec:.0f}% dos erros são de execução</b> (interpretação + desatenção). "
                "Seu gargalo não é conteúdo — treine gestão de tempo e atenção durante a prova.",
                cor=theme.AMARELO,
            )

        st.divider()

        col_exp, col_info = st.columns([1, 3])
        with col_exp:
            pendentes = df[df["card_feito"] == 0][["conceito", "resposta"]].dropna()
            if not pendentes.empty:
                csv_anki = pendentes.to_csv(index=False, header=False, sep=";",
                                            quoting=1, lineterminator="\n")
                st.download_button(
                    label="📥 Exportar para Anki (CSV)",
                    data=csv_anki.encode("utf-8"),
                    file_name="anki_r1.csv", mime="text/csv", type="primary")
            else:
                st.info("Nenhum card pendente.")
        with col_info:
            st.caption(
                "**Como importar no Anki:** Arquivo → Importar → selecione `anki_r1.csv` → "
                "separador `;` → Campo 1 = Frente, Campo 2 = Verso → Importar.")

        st.divider()
        st.subheader("Erros cadastrados")

        prio_label = {1: "🟢 Baixa", 2: "🟡 Média", 3: "🔴 Alta"}
        df["Prioridade"] = df["prioridade"].map(prio_label)
        df["Card"] = df["card_feito"].apply(lambda x: "✅" if x else "⬜")
        df["Prova"] = df.apply(
            lambda r: f"{r['banca']} {r['ano']} Q{r['numero_questao']}"
            if pd.notna(r.get("banca")) else f"Q{r['numero_questao']}", axis=1)

        st.dataframe(
            df[["id", "Prova", "area", "tema", "tipo_erro", "conceito", "resposta",
                "Prioridade", "Card"]].rename(columns={
                "id": "ID", "area": "Área", "tema": "Tema", "tipo_erro": "Tipo",
                "conceito": "Frente (conceito)", "resposta": "Verso (resposta)"}),
            use_container_width=True, hide_index=True)

        with st.expander("Marcar card como feito / não feito"):
            col_m1, col_m2 = st.columns(2)
            erro_id = col_m1.number_input("ID do erro", min_value=1, step=1)
            feito = col_m2.checkbox("Card feito?", value=True)
            if st.button("Atualizar"):
                db.marcar_card_feito(int(erro_id), feito)
                st.success("Atualizado!")
                st.rerun()

        with st.expander("🗑️ Excluir erro"):
            del_id = st.number_input("ID do erro para excluir", min_value=1, step=1)
            if st.button("Excluir erro", type="secondary"):
                db.deletar_erro(int(del_id))
                st.success(f"Erro {del_id} excluído.")
                st.rerun()
    else:
        st.info("Nenhum erro encontrado com os filtros aplicados.")

    st.divider()
    st.subheader("➕ Registrar novo erro")

    provas_raw = db.listar_provas()
    prova_opts = {f"{r['banca']} {r['ano']} (ID {r['id']})": r["id"] for r in provas_raw}

    with st.form("novo_erro", clear_on_submit=True):
        col1, col2, col3 = st.columns(3)
        prova_label = col1.selectbox("Prova", ["(sem prova)"] + list(prova_opts.keys()))
        numero_q = col2.number_input("Nº questão", min_value=1, value=1, step=1)
        prio = col3.selectbox("Prioridade", [1, 2, 3],
                              format_func=lambda p: {1: "🟢 Baixa", 2: "🟡 Média",
                                                     3: "🔴 Alta"}[p], index=1)

        col4, col5 = st.columns(2)
        area = col4.selectbox("Grande área", db.AREAS)
        tipo = col5.selectbox("Tipo de erro", db.TIPOS_ERRO)

        tema = st.text_input("Tema / Assunto", placeholder="Ex.: ICC descompensada")
        conceito = st.text_area("Frente do card (conceito / pergunta)", height=80,
                                 placeholder="O que são os critérios de Framingham?")
        resposta = st.text_area("Verso do card (resposta / macete)", height=100,
                                 placeholder="Maiores: dispneia paroxística, ortopneia...")

        if st.form_submit_button("Salvar erro", type="primary"):
            if not conceito.strip():
                st.error("Preencha a frente do card.")
            else:
                pid = prova_opts.get(prova_label) if prova_label != "(sem prova)" else None
                db.inserir_erro(pid, int(numero_q), area, tema.strip(),
                                tipo, conceito.strip(), resposta.strip(), int(prio))
                st.success("Erro salvo no banco!")
                st.rerun()
