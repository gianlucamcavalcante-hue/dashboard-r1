import streamlit as st
import pandas as pd
import db


def render():
    provas_raw = db.listar_provas()
    meta = int(db.get_config("meta_percentual", 70))

    if provas_raw:
        df = pd.DataFrame([dict(r) for r in provas_raw])
        df["pct"] = (df["acertos"] / df["total_questoes"] * 100).round(1)
        df["status"] = df["pct"].apply(
            lambda p: "✅ Acima da meta" if p >= meta
            else ("⚠️ Próximo" if p >= meta * 0.9 else "❌ Abaixo"))

        col_f1, col_f2, col_f3 = st.columns(3)
        bancas = ["Todas"] + sorted(df["banca"].unique().tolist())
        banca_sel = col_f1.selectbox("Banca", bancas)
        status_sel = col_f2.selectbox("Status",
                                      ["Todos", "✅ Acima da meta", "⚠️ Próximo", "❌ Abaixo"])
        anos = ["Todos"] + sorted(df["ano"].unique().tolist(), reverse=True)
        ano_sel = col_f3.selectbox("Ano", anos)

        df_f = df.copy()
        if banca_sel != "Todas":
            df_f = df_f[df_f["banca"] == banca_sel]
        if status_sel != "Todos":
            df_f = df_f[df_f["status"] == status_sel]
        if ano_sel != "Todos":
            df_f = df_f[df_f["ano"] == ano_sel]

        st.dataframe(
            df_f[["id", "banca", "ano", "data_feita",
                  "total_questoes", "acertos", "pct", "status"]].rename(columns={
                "id": "ID", "banca": "Banca", "ano": "Ano", "data_feita": "Data",
                "total_questoes": "Total Qs", "acertos": "Acertos",
                "pct": "% Acertos", "status": "Status"}),
            use_container_width=True, hide_index=True,
            column_config={
                "% Acertos": st.column_config.ProgressColumn(
                    "% Acertos", format="%.1f%%", min_value=0, max_value=100),
            },
        )

        prova_ids = df_f["id"].tolist()
        if prova_ids:
            st.subheader("Desempenho por área")
            prova_selecionada = st.selectbox(
                "Ver detalhes da prova:", options=df_f["id"].tolist(),
                format_func=lambda i: f"{df_f.loc[df_f['id']==i, 'banca'].values[0]} "
                                       f"{df_f.loc[df_f['id']==i, 'ano'].values[0]} (ID {i})",
            )
            areas = db.listar_desempenho_area(prova_selecionada)
            if areas:
                df_a = pd.DataFrame([dict(r) for r in areas])
                df_a["pct"] = (df_a["acertos"] / df_a["total"] * 100).round(1)
                st.dataframe(
                    df_a[["area", "acertos", "total", "pct"]].rename(columns={
                        "area": "Área", "acertos": "Acertos", "total": "Total", "pct": "%"}),
                    hide_index=True,
                    column_config={"%": st.column_config.ProgressColumn(
                        "%", format="%.1f%%", min_value=0, max_value=100)},
                )
            else:
                st.info("Nenhum dado de área para esta prova.")

        st.divider()
        with st.expander("🗑️ Excluir prova"):
            del_id = st.number_input("ID da prova para excluir", min_value=1, step=1)
            if st.button("Excluir", type="secondary"):
                db.deletar_prova(int(del_id))
                st.success(f"Prova {del_id} excluída.")
                st.rerun()
    else:
        st.info("Nenhuma prova cadastrada ainda.")

    st.divider()
    st.subheader("➕ Adicionar nova prova")

    with st.form("nova_prova", clear_on_submit=True):
        col1, col2 = st.columns(2)
        banca = col1.text_input("Banca", placeholder="USP-SP")
        ano = col2.number_input("Ano", min_value=2000, max_value=2030, value=2024, step=1)

        col3, col4, col5 = st.columns(3)
        data_feita = col3.date_input("Data que fiz")
        total_qs = col4.number_input("Total de questões", min_value=1, value=120, step=1)
        acertos = col5.number_input("Acertos", min_value=0, value=0, step=1)

        st.markdown("**Desempenho por grande área** *(acertos e total de cada área)*")
        area_cols = st.columns(len(db.AREAS))
        area_data = {}
        for i, area in enumerate(db.AREAS):
            with area_cols[i]:
                st.markdown(f"**{area}**")
                ac = st.number_input(f"Acertos##{area}", min_value=0, value=0, step=1,
                                      label_visibility="collapsed", key=f"ac_{area}")
                tot = st.number_input(f"Total##{area}", min_value=0, value=0, step=1,
                                       label_visibility="collapsed", key=f"tot_{area}")
                area_data[area] = (ac, tot)

        submitted = st.form_submit_button("Salvar prova", type="primary")
        if submitted:
            if not banca.strip():
                st.error("Informe a banca.")
            elif acertos > total_qs:
                st.error("Acertos não pode ser maior que total de questões.")
            else:
                pid = db.inserir_prova(banca.strip(), int(ano),
                                       str(data_feita), int(total_qs), int(acertos))
                for area, (ac, tot) in area_data.items():
                    if tot > 0:
                        db.inserir_desempenho_area(pid, area, int(ac), int(tot))
                pct = round(acertos / total_qs * 100, 1)
                st.success(f"Prova salva! {acertos}/{total_qs} = {pct}%")
                st.rerun()
