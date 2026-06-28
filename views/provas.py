import streamlit as st
import pandas as pd
import plotly.express as px
import db
import theme

# ordem de status nos seletores
STATUS_OPCOES = [db.STATUS_CORRIGIDA, db.STATUS_PENDENTE, db.STATUS_NAO_FIZ]

MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
         "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

_CAT_COR = {"corrigida": theme.VERDE, "parcial": theme.AMARELO,
            "a_corrigir": theme.AZUL, "sem": theme.ROXO}


def _mes_ano(valor):
    """Formata uma data como 'Abril/26'."""
    try:
        d = pd.to_datetime(valor)
        return f"{MESES[d.month]}/{d.strftime('%y')}"
    except Exception:
        return "—"


def _tabela_provas_html(df_f, modo):
    """Tabela HTML estilizada (letra maior, mais legível) das provas filtradas."""
    p = theme.palette(modo)
    th = (f"padding:11px 16px;text-align:left;font-size:.8rem;font-weight:700;"
          f"text-transform:uppercase;letter-spacing:.5px;color:{p['muted']};"
          f"border-bottom:2px solid {p['border']}")
    td = f"padding:11px 16px;text-align:left;font-size:1.02rem;color:{p['text']};border-bottom:1px solid {p['border']}"

    head = "".join(f"<th style='{th}'>{c}</th>"
                   for c in ["Banca", "Ano", "Data", "% Acertos", "Correção", "Não fiz"])
    linhas = ""
    for _, r in df_f.iterrows():
        cor = _CAT_COR.get(r["categoria"], p["muted"])
        chip = (f"<span style='background:{cor}22;color:{cor};border:1px solid {cor}55;"
                f"padding:4px 11px;border-radius:999px;font-weight:600;"
                f"white-space:nowrap'>{r['Correção']}</span>")
        nao = r["Não fiz"]
        nao_html = (f"<span style='color:{p['muted']}'>—</span>" if nao == "—"
                    else f"<span style='color:{theme.VERMELHO}'>{nao}</span>")
        celulas = [
            f"<b>{r['banca']}</b>", str(r["ano"]), r["data_mes"],
            f"<b>{r['% Acertos']}</b>", chip, nao_html,
        ]
        tds = "".join(f"<td style='{td}'>{c}</td>" for c in celulas)
        linhas += f"<tr>{tds}</tr>"

    st.markdown(
        f"<div style='overflow-x:auto;border:1px solid {p['border']};border-radius:14px'>"
        f"<table style='width:100%;border-collapse:collapse'>"
        f"<thead><tr>{head}</tr></thead><tbody>{linhas}</tbody></table></div>",
        unsafe_allow_html=True,
    )


def _resumo(areas_prova: pd.DataFrame):
    """Resumo de correção de UMA prova a partir das suas áreas."""
    if areas_prova.empty:
        return {"label": "⬜ Sem dados", "categoria": "sem", "nao_fiz": []}
    corr = (areas_prova["status"] == db.STATUS_CORRIGIDA).sum()
    pend = (areas_prova["status"] == db.STATUS_PENDENTE).sum()
    nao_fiz = areas_prova.loc[areas_prova["status"] == db.STATUS_NAO_FIZ, "area"].tolist()
    feitas = corr + pend
    if feitas == 0:
        label, categoria = "⬜ Sem dados", "sem"
    elif pend == 0:
        label, categoria = "✅ Corrigida", "corrigida"
    elif corr == 0:
        label, categoria = "⏳ A corrigir", "a_corrigir"
    else:
        label, categoria = f"🟡 Parcial ({corr}/{feitas} áreas)", "parcial"
    return {"label": label, "categoria": categoria, "nao_fiz": nao_fiz}


def render(modo="dark"):
    PLOT_LAYOUT, grid_color = theme.plot_layout(modo)
    meta = int(db.get_config("meta_percentual", 70))

    provas_raw = db.listar_provas()
    areas_all = pd.DataFrame(db.listar_desempenho_area())

    # ---------------- lista de provas ----------------
    if provas_raw:
        df = pd.DataFrame(provas_raw)

        # resumo de correção por prova
        resumos = {}
        for pid in df["id"]:
            ap = areas_all[areas_all["prova_id"] == pid] if not areas_all.empty else pd.DataFrame()
            resumos[pid] = _resumo(ap)

        df["Correção"] = df["id"].map(lambda i: resumos[i]["label"])
        df["categoria"] = df["id"].map(lambda i: resumos[i]["categoria"])
        df["Não fiz"] = df["id"].map(
            lambda i: ", ".join(resumos[i]["nao_fiz"]) if resumos[i]["nao_fiz"] else "—")

        def fmt_pct(r):
            if r["total_questoes"] <= 0:
                return "—"
            pct = round(r["acertos"] / r["total_questoes"] * 100, 1)
            sufixo = " (parcial)" if r["categoria"] in ("parcial", "a_corrigir") else ""
            return f"{pct}%{sufixo}"

        df["% Acertos"] = df.apply(fmt_pct, axis=1)
        df["data_mes"] = df["data_feita"].map(_mes_ano)

        # filtros
        col_f1, col_f2, col_f3 = st.columns(3)
        bancas = ["Todas"] + sorted(df["banca"].unique().tolist())
        banca_sel = col_f1.selectbox("Banca", bancas)
        corr_sel = col_f2.selectbox(
            "Correção", ["Todas", "✅ Corrigida", "🟡 Parcial", "⏳ A corrigir"])
        anos = ["Todos"] + sorted(df["ano"].unique().tolist(), reverse=True)
        ano_sel = col_f3.selectbox("Ano", anos)

        df_f = df.copy()
        if banca_sel != "Todas":
            df_f = df_f[df_f["banca"] == banca_sel]
        if ano_sel != "Todos":
            df_f = df_f[df_f["ano"] == ano_sel]
        _map_cat = {"✅ Corrigida": "corrigida", "🟡 Parcial": "parcial", "⏳ A corrigir": "a_corrigir"}
        if corr_sel in _map_cat:
            df_f = df_f[df_f["categoria"] == _map_cat[corr_sel]]

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

        # ---------------- corrigir / atualizar ----------------
        st.divider()
        with st.expander("✏️ Corrigir / atualizar uma prova"):
            st.caption("Marque o que já corrigiu. A prova vira **✅ Corrigida** "
                       "automaticamente quando nenhuma área ficar pendente.")
            opc_edit = {f"{r['banca']} {r['ano']} (ID {r['id']})": r["id"]
                        for _, r in df.iterrows()}
            label_sel = st.selectbox("Prova", list(opc_edit.keys()), key="edit_prova")
            pid = opc_edit[label_sel]
            ap = areas_all[areas_all["prova_id"] == pid] if not areas_all.empty else pd.DataFrame()
            atual = {row["area"]: row for _, row in ap.iterrows()}

            novas_areas = []
            for area in db.AREAS:
                cur = atual.get(area)
                st_atual = cur["status"] if cur is not None else db.STATUS_PENDENTE
                ac_atual = int(cur["acertos"]) if cur is not None else 0
                tot_atual = int(cur["total"]) if cur is not None else 0

                c0, c1, c2, c3 = st.columns([2, 2, 1, 1])
                c0.markdown(f"**{area}**")
                idx = STATUS_OPCOES.index(st_atual) if st_atual in STATUS_OPCOES else 1
                status = c1.selectbox("status", STATUS_OPCOES, index=idx,
                                      format_func=lambda s: db.STATUS_LABEL[s],
                                      key=f"edit_st_{pid}_{area}", label_visibility="collapsed")
                ac = c2.number_input("acertos", min_value=0, value=ac_atual, step=1,
                                     key=f"edit_ac_{pid}_{area}", label_visibility="collapsed")
                tot = c3.number_input("total", min_value=0, value=tot_atual, step=1,
                                      key=f"edit_tot_{pid}_{area}", label_visibility="collapsed")
                novas_areas.append({"area": area, "status": status,
                                    "acertos": int(ac), "total": int(tot)})

            if st.button("💾 Salvar correção", type="primary", key="salvar_corr"):
                erro = next((a for a in novas_areas
                             if a["status"] == db.STATUS_CORRIGIDA and a["acertos"] > a["total"]),
                            None)
                if erro:
                    st.error(f"{erro['area']}: acertos não pode ser maior que total.")
                else:
                    db.atualizar_areas(pid, novas_areas)
                    st.success("Correção atualizada!")
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
    st.caption("Para cada área escolha: **✅ Corrigida** (preencha acertos e total), "
               "**🟡 A corrigir** (fiz mas ainda não corrigi) ou **⬜ Não fiz**.")

    with st.form("nova_prova", clear_on_submit=True):
        col1, col2, col3 = st.columns(3)
        banca = col1.text_input("Banca", placeholder="USP-SP")
        ano = col2.number_input("Ano", min_value=2000, max_value=2030, value=2024, step=1)
        data_feita = col3.date_input("Data que fiz")

        st.markdown("**Desempenho por grande área**")
        cabec = st.columns([2, 2, 1, 1])
        cabec[0].caption("Área")
        cabec[1].caption("Status")
        cabec[2].caption("Acertos")
        cabec[3].caption("Total")

        entradas = []
        for area in db.AREAS:
            c0, c1, c2, c3 = st.columns([2, 2, 1, 1])
            c0.markdown(f"**{area}**")
            status = c1.selectbox("status", STATUS_OPCOES, index=0,
                                  format_func=lambda s: db.STATUS_LABEL[s],
                                  key=f"novo_st_{area}", label_visibility="collapsed")
            ac = c2.number_input("acertos", min_value=0, value=0, step=1,
                                 key=f"novo_ac_{area}", label_visibility="collapsed")
            tot = c3.number_input("total", min_value=0, value=0, step=1,
                                  key=f"novo_tot_{area}", label_visibility="collapsed")
            entradas.append({"area": area, "status": status,
                             "acertos": int(ac), "total": int(tot)})

        submitted = st.form_submit_button("Salvar prova", type="primary")
        if submitted:
            erro = next((a for a in entradas
                         if a["status"] == db.STATUS_CORRIGIDA and a["acertos"] > a["total"]),
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
    """df_ag: colunas area, pct (já filtrado para áreas com dados)."""
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


def _desempenho_global(areas_all, meta, PLOT_LAYOUT, grid_color, modo):
    if areas_all.empty:
        st.info("Nenhum dado de área ainda.")
        return
    corr = areas_all[areas_all["status"] == db.STATUS_CORRIGIDA]
    if corr.empty:
        st.info("Nenhuma área corrigida ainda. Corrija alguma prova para ver o global.")
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
                 f"somando todas as provas corrigidas.",
                 cor=theme.VERMELHO, icone="🎯", modo=modo)

    # áreas sem dados corrigidos
    sem_dados = [a for a in db.AREAS if a not in df_ag["area"].tolist()]
    if sem_dados:
        st.caption("Ainda sem dados corrigidos em: " + ", ".join(sem_dados))


def _desempenho_prova(pid, areas_all, meta, PLOT_LAYOUT, grid_color, modo):
    ap = areas_all[areas_all["prova_id"] == pid].copy() if not areas_all.empty else pd.DataFrame()
    if ap.empty:
        st.info("Sem dados de área para esta prova.")
        return

    ap["Status"] = ap["status"].map(db.STATUS_LABEL)
    ap["%"] = ap.apply(
        lambda r: round(r["acertos"] / r["total"] * 100, 1)
        if r["status"] == db.STATUS_CORRIGIDA and r["total"] > 0 else None, axis=1)

    # garante ordem das áreas
    ap["ordem"] = ap["area"].map({a: i for i, a in enumerate(db.AREAS)})
    ap = ap.sort_values("ordem")

    corr = ap[(ap["status"] == db.STATUS_CORRIGIDA) & (ap["total"] > 0)]

    # média das áreas já corrigidas (mesmo se a prova ainda estiver incompleta)
    if not corr.empty:
        media_parcial = round(corr["acertos"].sum() / corr["total"].sum() * 100, 1)
        completa = len(corr) == len(db.AREAS)
        cm1, cm2 = st.columns(2)
        cm1.metric("Áreas corrigidas", f"{len(corr)}/{len(db.AREAS)}")
        cm2.metric("Média " + ("(completa)" if completa else "(áreas corrigidas)"),
                   f"{media_parcial}%")

        df_ag = corr[["area", "acertos", "total"]].copy()
        df_ag["pct"] = (df_ag["acertos"] / df_ag["total"] * 100).round(1)
        fig, _ = _grafico_areas(df_ag, meta, PLOT_LAYOUT, grid_color)
        st.plotly_chart(fig, use_container_width=True, key=f"prov_area_{pid}")
    else:
        st.info("Nenhuma área desta prova foi corrigida ainda.")

    st.dataframe(
        ap[["area", "Status", "acertos", "total", "%"]].rename(columns={
            "area": "Área", "acertos": "Acertos", "total": "Total"}),
        hide_index=True, use_container_width=True,
        column_config={"%": st.column_config.NumberColumn("%", format="%.1f%%")})

    pend = ap.loc[ap["status"] == db.STATUS_PENDENTE, "area"].tolist()
    nao = ap.loc[ap["status"] == db.STATUS_NAO_FIZ, "area"].tolist()
    if pend:
        st.caption("🟡 Ainda a corrigir: " + ", ".join(pend))
    if nao:
        st.caption("⬜ Não fiz: " + ", ".join(nao))
