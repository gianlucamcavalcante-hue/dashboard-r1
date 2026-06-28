import streamlit as st
import pandas as pd
import plotly.express as px
import db
import theme

# Fiz / Não fiz nos seletores
STATUS_OPCOES = [db.STATUS_FIZ, db.STATUS_NAO_FIZ]

MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
         "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

_CAT_COR = {"completa": theme.VERDE, "parcial": theme.AMARELO, "sem": theme.ROXO}


def _mes_ano(valor):
    """Formata uma data como 'Abril/26'."""
    try:
        d = pd.to_datetime(valor)
        return f"{MESES[d.month]}/{d.strftime('%y')}"
    except Exception:
        return "—"


def _resumo(ap: pd.DataFrame):
    """Resumo de UMA prova a partir das suas áreas."""
    n_areas = len(db.AREAS)
    if ap.empty:
        return {"categoria": "sem", "label": "⬜ Sem notas", "nao_fiz": [],
                "n_com_nota": 0, "n_feitas": 0, "n_estudadas": 0}
    feitas = ap[ap["status"] == db.STATUS_FIZ]
    com_nota = feitas[feitas["total"] > 0]
    nao_fiz = ap.loc[ap["status"] == db.STATUS_NAO_FIZ, "area"].tolist()
    n_com_nota = len(com_nota)
    n_estudadas = int(feitas["estudada"].sum()) if "estudada" in feitas.columns else 0
    if n_com_nota == 0:
        cat, label = "sem", "⬜ Sem notas"
    elif n_com_nota == n_areas:
        cat, label = "completa", "✅ Completa"
    else:
        cat, label = "parcial", f"🟡 Parcial ({n_com_nota}/{n_areas})"
    return {"categoria": cat, "label": label, "nao_fiz": nao_fiz,
            "n_com_nota": n_com_nota, "n_feitas": len(feitas), "n_estudadas": n_estudadas}


def _tabela_provas_html(df_f, modo):
    """Tabela HTML estilizada (letra maior, mais legível) das provas filtradas."""
    p = theme.palette(modo)
    th = (f"padding:11px 16px;text-align:left;font-size:.8rem;font-weight:700;"
          f"text-transform:uppercase;letter-spacing:.5px;color:{p['muted']};"
          f"border-bottom:2px solid {p['border']}")
    td = (f"padding:11px 16px;text-align:left;font-size:1.02rem;color:{p['text']};"
          f"border-bottom:1px solid {p['border']}")

    cols = ["Banca", "Data", "% Acertos", "Situação", "Erros estudados", "Não fiz"]
    head = "".join(f"<th style='{th}'>{c}</th>" for c in cols)
    linhas = ""
    for _, r in df_f.iterrows():
        cor = _CAT_COR.get(r["categoria"], p["muted"])
        chip = (f"<span style='background:{cor}22;color:{cor};border:1px solid {cor}55;"
                f"padding:4px 11px;border-radius:999px;font-weight:600;"
                f"white-space:nowrap'>{r['Situação']}</span>")
        nao = r["Não fiz"]
        nao_html = (f"<span style='color:{p['muted']}'>—</span>" if nao == "—"
                    else f"<span style='color:{theme.VERMELHO}'>{nao}</span>")
        celulas = [
            f"<b>{r['banca']}</b>", r["data_mes"], f"<b>{r['% Acertos']}</b>",
            chip, r["Estudo"], nao_html,
        ]
        tds = "".join(f"<td style='{td}'>{c}</td>" for c in celulas)
        linhas += f"<tr>{tds}</tr>"

    st.markdown(
        f"<div style='overflow-x:auto;border:1px solid {p['border']};border-radius:14px'>"
        f"<table style='width:100%;border-collapse:collapse'>"
        f"<thead><tr>{head}</tr></thead><tbody>{linhas}</tbody></table></div>",
        unsafe_allow_html=True,
    )


def render(modo="dark"):
    PLOT_LAYOUT, grid_color = theme.plot_layout(modo)
    meta = int(db.get_config("meta_percentual", 70))

    provas_raw = db.listar_provas()
    areas_all = pd.DataFrame(db.listar_desempenho_area())

    # ---------------- lista de provas ----------------
    if provas_raw:
        df = pd.DataFrame(provas_raw)

        resumos = {}
        for pid in df["id"]:
            ap = areas_all[areas_all["prova_id"] == pid] if not areas_all.empty else pd.DataFrame()
            resumos[pid] = _resumo(ap)

        df["Situação"] = df["id"].map(lambda i: resumos[i]["label"])
        df["categoria"] = df["id"].map(lambda i: resumos[i]["categoria"])
        df["Não fiz"] = df["id"].map(
            lambda i: ", ".join(resumos[i]["nao_fiz"]) if resumos[i]["nao_fiz"] else "—")
        df["Estudo"] = df["id"].map(
            lambda i: (f"{resumos[i]['n_estudadas']}/{resumos[i]['n_feitas']}"
                       if resumos[i]["n_feitas"] else "—"))

        def fmt_pct(r):
            if r["total_questoes"] <= 0:
                return "—"
            pct = round(r["acertos"] / r["total_questoes"] * 100, 1)
            sufixo = " (parcial)" if r["categoria"] != "completa" else ""
            return f"{pct}%{sufixo}"

        df["% Acertos"] = df.apply(fmt_pct, axis=1)
        df["data_mes"] = df["data_feita"].map(_mes_ano)

        # filtros
        col_f1, col_f2, col_f3 = st.columns(3)
        bancas = ["Todas"] + sorted(df["banca"].unique().tolist())
        banca_sel = col_f1.selectbox("Banca", bancas)
        sit_sel = col_f2.selectbox(
            "Situação", ["Todas", "✅ Completa", "🟡 Parcial", "⬜ Sem notas"])
        anos = ["Todos"] + sorted(df["ano"].unique().tolist(), reverse=True)
        ano_sel = col_f3.selectbox("Ano", anos)

        df_f = df.copy()
        if banca_sel != "Todas":
            df_f = df_f[df_f["banca"] == banca_sel]
        if ano_sel != "Todos":
            df_f = df_f[df_f["ano"] == ano_sel]
        _map_cat = {"✅ Completa": "completa", "🟡 Parcial": "parcial", "⬜ Sem notas": "sem"}
        if sit_sel in _map_cat:
            df_f = df_f[df_f["categoria"] == _map_cat[sit_sel]]

        if df_f.empty:
            st.info("Nenhuma prova com esses filtros.")
        else:
            _tabela_provas_html(df_f.sort_values("data_feita", ascending=False), modo)

        # ---------------- desempenho por área ----------------
        st.divider()
        st.subheader("📊 Desempenho por área")

        GLOBAL = "🌍 Todas as provas (global)"
        opcoes = [GLOBAL] + [
            f"{r['banca']} {r['ano']} (ID {r['id']})" for _, r in df.iterrows()]
        escolha = st.selectbox("Ver desempenho de:", opcoes)

        if escolha == GLOBAL:
            _desempenho_global(areas_all, meta, PLOT_LAYOUT, grid_color, modo)
        else:
            pid = int(escolha.split("ID ")[1].rstrip(")"))
            _desempenho_prova(pid, areas_all, meta, PLOT_LAYOUT, grid_color, modo)

        # ---------------- evolução por área ----------------
        st.divider()
        st.subheader("📈 Evolução por área (ao longo do tempo)")
        area_evo = st.selectbox("Área", db.AREAS, key="evo_area")
        _evolucao_area(area_evo, areas_all, df, meta, PLOT_LAYOUT, grid_color, modo)

        # ---------------- atualizar / estudo dos erros ----------------
        st.divider()
        with st.expander("✏️ Atualizar prova (notas e estudo dos erros)"):
            st.caption("Preencha **acertos/total** das áreas que você fez (o % é calculado "
                       "na hora). Marque **📚 estudei** quando já tiver estudado os erros "
                       "daquela área.")
            opc_edit = {f"{r['banca']} {r['ano']} (ID {r['id']})": r["id"]
                        for _, r in df.iterrows()}
            label_sel = st.selectbox("Prova", list(opc_edit.keys()), key="edit_prova")
            pid = opc_edit[label_sel]
            ap = areas_all[areas_all["prova_id"] == pid] if not areas_all.empty else pd.DataFrame()
            atual = {row["area"]: row for _, row in ap.iterrows()}

            cab = st.columns([2.2, 1.8, 1, 1, 1.4])
            for c, t in zip(cab, ["Área", "Fiz?", "Acertos", "Total", "Erros"]):
                c.caption(t)

            novas_areas = []
            for area in db.AREAS:
                cur = atual.get(area)
                st_atual = cur["status"] if cur is not None else db.STATUS_FIZ
                ac_atual = int(cur["acertos"]) if cur is not None else 0
                tot_atual = int(cur["total"]) if cur is not None else 0
                est_atual = bool(cur["estudada"]) if cur is not None and "estudada" in cur else False

                c0, c1, c2, c3, c4 = st.columns([2.2, 1.8, 1, 1, 1.4])
                c0.markdown(f"**{area}**")
                idx = STATUS_OPCOES.index(st_atual) if st_atual in STATUS_OPCOES else 0
                status = c1.selectbox("fiz", STATUS_OPCOES, index=idx,
                                      format_func=lambda s: db.STATUS_LABEL[s],
                                      key=f"edit_st_{pid}_{area}", label_visibility="collapsed")
                ac = c2.number_input("acertos", min_value=0, value=ac_atual, step=1,
                                     key=f"edit_ac_{pid}_{area}", label_visibility="collapsed")
                tot = c3.number_input("total", min_value=0, value=tot_atual, step=1,
                                      key=f"edit_tot_{pid}_{area}", label_visibility="collapsed")
                est = c4.checkbox("📚 estudei", value=est_atual, key=f"edit_es_{pid}_{area}")
                novas_areas.append({"area": area, "status": status, "acertos": int(ac),
                                    "total": int(tot), "estudada": bool(est)})

            if st.button("💾 Salvar", type="primary", key="salvar_corr"):
                erro = next((a for a in novas_areas
                             if a["status"] == db.STATUS_FIZ and a["acertos"] > a["total"]),
                            None)
                if erro:
                    st.error(f"{erro['area']}: acertos não pode ser maior que total.")
                else:
                    db.atualizar_areas(pid, novas_areas)
                    st.success("Atualizado!")
                    st.rerun()

        # ---------------- excluir ----------------
        with st.expander("🗑️ Excluir prova"):
            opc_del = {f"{r['banca']} {r['ano']} (ID {r['id']})": r["id"]
                       for _, r in df.iterrows()}
            label_del = st.selectbox("Prova para excluir", list(opc_del.keys()), key="del_prova")
            if st.button("Excluir", type="secondary"):
                db.deletar_prova(opc_del[label_del])
                st.success("Prova excluída.")
                st.rerun()
    else:
        st.info("Nenhuma prova cadastrada ainda. Adicione abaixo. 👇")

    # ---------------- adicionar nova prova ----------------
    st.divider()
    st.subheader("➕ Adicionar nova prova")
    st.caption("Para cada área marque **Fiz** (preencha acertos e total — o % sai na hora) "
               "ou **Não fiz**. O estudo dos erros você marca depois, em "
               "*Atualizar prova*.")

    with st.form("nova_prova", clear_on_submit=True):
        col1, col2, col3 = st.columns(3)
        banca = col1.text_input("Banca", placeholder="USP-SP")
        ano = col2.number_input("Ano", min_value=2000, max_value=2030, value=2024, step=1)
        data_feita = col3.date_input("Data que fiz")

        st.markdown("**Desempenho por grande área**")
        cab = st.columns([2.2, 1.8, 1, 1])
        for c, t in zip(cab, ["Área", "Fiz?", "Acertos", "Total"]):
            c.caption(t)

        entradas = []
        for area in db.AREAS:
            c0, c1, c2, c3 = st.columns([2.2, 1.8, 1, 1])
            c0.markdown(f"**{area}**")
            status = c1.selectbox("fiz", STATUS_OPCOES, index=0,
                                  format_func=lambda s: db.STATUS_LABEL[s],
                                  key=f"novo_st_{area}", label_visibility="collapsed")
            ac = c2.number_input("acertos", min_value=0, value=0, step=1,
                                 key=f"novo_ac_{area}", label_visibility="collapsed")
            tot = c3.number_input("total", min_value=0, value=0, step=1,
                                  key=f"novo_tot_{area}", label_visibility="collapsed")
            entradas.append({"area": area, "status": status, "acertos": int(ac),
                             "total": int(tot), "estudada": False})

        submitted = st.form_submit_button("Salvar prova", type="primary")
        if submitted:
            erro = next((a for a in entradas
                         if a["status"] == db.STATUS_FIZ and a["acertos"] > a["total"]),
                        None)
            if not banca.strip():
                st.error("Informe a banca.")
            elif erro:
                st.error(f"{erro['area']}: acertos não pode ser maior que total.")
            else:
                db.inserir_prova(banca.strip(), int(ano), str(data_feita), entradas)
                st.success("Prova salva!")
                st.rerun()


# ---------------- helpers de gráfico ----------------

def _grafico_areas(df_ag, meta, PLOT_LAYOUT, grid_color):
    """df_ag: colunas area, pct (já filtrado para áreas com nota)."""
    df_ag = df_ag.sort_values("pct")
    area_fraca = df_ag.iloc[0]["area"]
    df_ag["cor"] = df_ag["area"].apply(
        lambda a: "🔴 Prioridade" if a == area_fraca else "Normal")
    fig = px.bar(
        df_ag, x="pct", y="area", orientation="h", color="cor",
        color_discrete_map={"🔴 Prioridade": theme.VERMELHO, "Normal": theme.ROXO},
        labels={"pct": "Acertos (%)", "area": "Área"}, text="pct")
    fig.add_vline(x=meta, line_dash="dash", line_color=theme.AMARELO)
    fig.update_traces(texttemplate="%{text}%", textposition="outside",
                      marker=dict(line=dict(width=0)))
    fig.update_layout(showlegend=True, xaxis_range=[0, 105], **PLOT_LAYOUT)
    fig.update_xaxes(gridcolor=grid_color)
    return fig, area_fraca


def _areas_com_nota(areas_all):
    """Áreas efetivamente feitas e com nota (total > 0)."""
    if areas_all.empty:
        return pd.DataFrame()
    return areas_all[(areas_all["status"] == db.STATUS_FIZ) & (areas_all["total"] > 0)]


def _desempenho_global(areas_all, meta, PLOT_LAYOUT, grid_color, modo):
    corr = _areas_com_nota(areas_all)
    if corr.empty:
        st.info("Nenhuma área com nota ainda. Preencha acertos/total de alguma prova.")
        return

    df_ag = (corr.groupby("area")
             .agg(acertos=("acertos", "sum"), total=("total", "sum"))
             .reset_index())
    df_ag = df_ag[df_ag["total"] > 0]
    df_ag["pct"] = (df_ag["acertos"] / df_ag["total"] * 100).round(1)

    fig, area_fraca = _grafico_areas(df_ag.copy(), meta, PLOT_LAYOUT, grid_color)
    st.plotly_chart(fig, use_container_width=True, key="prov_area_global")
    theme.banner(f"<b>Área prioritária: {area_fraca}</b> — "
                 f"{df_ag.loc[df_ag['area'] == area_fraca, 'pct'].values[0]}% de acerto "
                 f"somando todas as provas.",
                 cor=theme.VERMELHO, icone="🎯", modo=modo)

    sem_dados = [a for a in db.AREAS if a not in df_ag["area"].tolist()]
    if sem_dados:
        st.caption("Ainda sem notas em: " + ", ".join(sem_dados))


def _desempenho_prova(pid, areas_all, meta, PLOT_LAYOUT, grid_color, modo):
    ap = areas_all[areas_all["prova_id"] == pid].copy() if not areas_all.empty else pd.DataFrame()
    if ap.empty:
        st.info("Sem dados de área para esta prova.")
        return

    ap["Status"] = ap["status"].map(db.STATUS_LABEL)
    ap["%"] = ap.apply(
        lambda r: round(r["acertos"] / r["total"] * 100, 1)
        if r["status"] == db.STATUS_FIZ and r["total"] > 0 else None, axis=1)
    ap["Erros"] = ap.apply(
        lambda r: "📚 estudado" if (r["status"] == db.STATUS_FIZ and r.get("estudada"))
        else ("—" if r["status"] == db.STATUS_FIZ else ""), axis=1)
    ap["ordem"] = ap["area"].map({a: i for i, a in enumerate(db.AREAS)})
    ap = ap.sort_values("ordem")

    com_nota = ap[(ap["status"] == db.STATUS_FIZ) & (ap["total"] > 0)]
    if not com_nota.empty:
        media_parcial = round(com_nota["acertos"].sum() / com_nota["total"].sum() * 100, 1)
        completa = len(com_nota) == len(db.AREAS)
        cm1, cm2 = st.columns(2)
        cm1.metric("Áreas com nota", f"{len(com_nota)}/{len(db.AREAS)}")
        cm2.metric("Média " + ("(completa)" if completa else "(áreas feitas)"),
                   f"{media_parcial}%")

        df_ag = com_nota[["area", "acertos", "total"]].copy()
        df_ag["pct"] = (df_ag["acertos"] / df_ag["total"] * 100).round(1)
        fig, _ = _grafico_areas(df_ag, meta, PLOT_LAYOUT, grid_color)
        st.plotly_chart(fig, use_container_width=True, key=f"prov_area_{pid}")
    else:
        st.info("Nenhuma área desta prova tem nota ainda.")

    st.dataframe(
        ap[["area", "Status", "acertos", "total", "%", "Erros"]].rename(columns={
            "area": "Área", "acertos": "Acertos", "total": "Total"}),
        hide_index=True, use_container_width=True,
        column_config={"%": st.column_config.NumberColumn("%", format="%.1f%%")})

    nao = ap.loc[ap["status"] == db.STATUS_NAO_FIZ, "area"].tolist()
    if nao:
        st.caption("⬜ Não fiz: " + ", ".join(nao))


def _evolucao_area(area, areas_all, df_provas, meta, PLOT_LAYOUT, grid_color, modo):
    corr = _areas_com_nota(areas_all)
    a = corr[corr["area"] == area].copy() if not corr.empty else pd.DataFrame()
    if a.empty:
        st.info(f"Nenhuma nota registrada em **{area}** ainda.")
        return

    a["pct"] = (a["acertos"] / a["total"] * 100).round(1)
    m = a.merge(df_provas[["id", "banca", "ano", "data_feita"]],
                left_on="prova_id", right_on="id")
    m["data_feita"] = pd.to_datetime(m["data_feita"])
    m = m.sort_values("data_feita")
    m["rotulo"] = m["banca"] + " " + m["ano"].astype(str)

    fig = px.line(
        m, x="data_feita", y="pct", markers=True,
        hover_data={"rotulo": True, "acertos": True, "total": True, "data_feita": False},
        labels={"data_feita": "Data", "pct": f"% em {area}"})
    fig.add_hline(y=meta, line_dash="dash", line_color=theme.AMARELO,
                  annotation_text=f"Meta {meta}%", annotation_position="bottom right")
    fig.update_traces(line=dict(width=3, color=theme.ROXO), marker=dict(size=11, color=theme.ROXO))
    fig.update_layout(yaxis_range=[0, 100], **PLOT_LAYOUT)
    fig.update_xaxes(gridcolor=grid_color)
    fig.update_yaxes(gridcolor=grid_color)
    st.plotly_chart(fig, use_container_width=True, key=f"evo_{area}")

    if len(m) >= 2:
        ini, fim = m["pct"].iloc[0], m["pct"].iloc[-1]
        delta = round(fim - ini, 1)
        tend = "📈 subindo" if delta > 0 else ("📉 caindo" if delta < 0 else "➡️ estável")
        st.caption(f"De {_mes_ano(m['data_feita'].iloc[0])} a {_mes_ano(m['data_feita'].iloc[-1])}: "
                   f"{ini}% → {fim}% ({tend}, {delta:+.1f} pts).")
    else:
        st.caption("Registre essa área em mais provas para ver a tendência ao longo do tempo.")
