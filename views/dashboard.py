import streamlit as st
import pandas as pd
import plotly.express as px
import db
import theme


def render(modo="dark"):
    PLOT_LAYOUT, grid_color = theme.plot_layout(modo)

    provas_raw = db.listar_provas()
    if not provas_raw:
        st.warning("Nenhuma prova cadastrada. Adicione provas na aba **Provas**.")
        return

    df = pd.DataFrame(provas_raw)
    df["data_feita"] = pd.to_datetime(df["data_feita"])
    meta = int(db.get_config("meta_percentual", 70))

    # áreas (usadas para saber quais provas estão completas)
    areas_raw = db.listar_desempenho_area()
    df_areas = pd.DataFrame(areas_raw) if areas_raw else pd.DataFrame()

    # uma prova é "completa" quando TODAS as áreas foram feitas e têm nota (acertos/total)
    completas_ids = set()
    if not df_areas.empty:
        for pid, g in df_areas.groupby("prova_id"):
            com_nota = set(g.loc[(g["status"] == db.STATUS_FIZ) & (g["total"] > 0), "area"])
            if set(db.AREAS).issubset(com_nota):
                completas_ids.add(pid)

    # só as provas completas entram no balanço principal (médias, melhor/pior, evolução)
    df_comp = df[df["id"].isin(completas_ids)].copy()
    n_incompletas = len(df) - len(df_comp)

    if df_comp.empty:
        st.info("Você ainda não tem nenhuma prova **completa** (todas as áreas feitas e "
                "corrigidas). As estatísticas principais só consideram provas completas — "
                "termine de corrigir alguma na aba **Provas**.")
        st.metric("Provas cadastradas", len(df))
        return

    df_comp["pct"] = (df_comp["acertos"] / df_comp["total_questoes"] * 100).round(1)

    def cor_pct(pct, meta):
        if pct >= meta:
            return "normal"
        elif pct >= meta * 0.9:
            return "off"
        return "inverse"

    # KPIs (somente provas completas)
    media = df_comp["pct"].mean()
    melhor = df_comp.loc[df_comp["pct"].idxmax()]
    pior = df_comp.loc[df_comp["pct"].idxmin()]
    gap = media - meta

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Provas completas", len(df_comp),
              delta=(f"{n_incompletas} incompleta(s)" if n_incompletas else None),
              delta_color="off")
    c2.metric("Média geral", f"{media:.1f}%",
              delta=f"{gap:+.1f}% vs meta ({meta}%)", delta_color=cor_pct(media, meta))
    c3.metric("Melhor prova", f"{melhor['pct']}%", f"{melhor['banca']} {melhor['ano']}")
    c4.metric("Pior prova", f"{pior['pct']}%", f"{pior['banca']} {pior['ano']}",
              delta_color="inverse")
    usp = df_comp[df_comp["banca"] == "USP-SP"]
    if not usp.empty:
        media_usp = usp["pct"].mean()
        c5.metric("Média USP-SP", f"{media_usp:.1f}%", delta=f"{media_usp - meta:+.1f}% vs meta")
    else:
        c5.metric("Média USP-SP", "—")

    if n_incompletas:
        st.caption(f"ℹ️ {n_incompletas} prova(s) incompleta(s) (faltam áreas feitas ou sem nota) "
                   "não entram nas médias, melhor e pior prova acima.")

    st.divider()

    # evolução
    st.subheader("Evolução do desempenho")
    df_sorted = df_comp.sort_values("data_feita")
    fig_linha = px.line(
        df_sorted, x="data_feita", y="pct", color="banca", markers=True,
        labels={"data_feita": "Data", "pct": "Acertos (%)", "banca": "Banca"},
        hover_data={"ano": True, "acertos": True, "total_questoes": True},
        color_discrete_sequence=["#818cf8", "#38bdf8", "#34d399", "#fbbf24"],
    )
    fig_linha.add_hline(y=meta, line_dash="dash", line_color=theme.AMARELO,
                        annotation_text=f"Meta {meta}%", annotation_position="bottom right")
    fig_linha.update_traces(line=dict(width=3), marker=dict(size=10))
    fig_linha.update_layout(yaxis_range=[0, 100], **PLOT_LAYOUT)
    fig_linha.update_xaxes(gridcolor=grid_color)
    fig_linha.update_yaxes(gridcolor=grid_color)
    st.plotly_chart(fig_linha, use_container_width=True, key="dash_evolucao")

    st.divider()

    col_a, col_b = st.columns(2)
    with col_a:
        st.subheader("Desempenho por grande área")
        st.caption("Considera todas as áreas com nota (mesmo de provas incompletas).")
        corr_areas = (df_areas[(df_areas["status"] == db.STATUS_FIZ) & (df_areas["total"] > 0)]
                      if not df_areas.empty else pd.DataFrame())
        if not corr_areas.empty:
            df_ag = (corr_areas.groupby("area")
                     .agg(acertos=("acertos", "sum"), total=("total", "sum"))
                     .reset_index())
            df_ag = df_ag[df_ag["total"] > 0]
            df_ag["pct"] = (df_ag["acertos"] / df_ag["total"] * 100).round(1)
            df_ag = df_ag.sort_values("pct")
            area_fraca = df_ag.iloc[0]["area"]
            df_ag["cor"] = df_ag["area"].apply(
                lambda a: "🔴 Prioridade" if a == area_fraca else "Normal")

            fig_bar = px.bar(
                df_ag, x="pct", y="area", orientation="h", color="cor",
                color_discrete_map={"🔴 Prioridade": theme.VERMELHO, "Normal": theme.ROXO},
                labels={"pct": "Acertos (%)", "area": "Área"}, text="pct",
            )
            fig_bar.add_vline(x=meta, line_dash="dash", line_color=theme.AMARELO)
            fig_bar.update_traces(texttemplate="%{text}%", textposition="outside",
                                  marker=dict(line=dict(width=0)))
            fig_bar.update_layout(showlegend=True, xaxis_range=[0, 105], **PLOT_LAYOUT)
            fig_bar.update_xaxes(gridcolor=grid_color)
            st.plotly_chart(fig_bar, use_container_width=True, key="dash_areas")
            theme.banner(f"<b>Área prioritária: {area_fraca}</b> — apenas "
                         f"{df_ag.iloc[0]['pct']}% de acerto.", cor=theme.VERMELHO, icone="🎯",
                         modo=modo)
        else:
            st.info("Corrija ao menos uma área para ver este gráfico.")

    with col_b:
        st.subheader("Desempenho por banca")
        df_banca = (
            df_comp.groupby("banca")
            .apply(lambda x: pd.Series({"media_pct": x["pct"].mean().round(1),
                                        "provas": len(x)}))
            .reset_index().sort_values("media_pct", ascending=False)
        )
        df_banca["destaque"] = df_banca["banca"].apply(
            lambda b: "⭐ USP-SP" if b == "USP-SP" else "Outras")
        fig_banca = px.bar(
            df_banca, x="banca", y="media_pct", color="destaque",
            color_discrete_map={"⭐ USP-SP": theme.AMARELO, "Outras": theme.AZUL},
            labels={"banca": "Banca", "media_pct": "Média (%)"},
            text="media_pct", hover_data={"provas": True},
        )
        fig_banca.add_hline(y=meta, line_dash="dash", line_color=theme.AMARELO,
                            annotation_text=f"Meta {meta}%")
        fig_banca.update_traces(texttemplate="%{text}%", textposition="outside")
        fig_banca.update_layout(yaxis_range=[0, 105], **PLOT_LAYOUT)
        fig_banca.update_yaxes(gridcolor=grid_color)
        st.plotly_chart(fig_banca, use_container_width=True, key="dash_banca")

    # ---------------- estudo dos erros ----------------
    feitas = (df_areas[df_areas["status"] == db.STATUS_FIZ]
              if not df_areas.empty else pd.DataFrame())
    if not feitas.empty and "estudada" in feitas.columns:
        st.divider()
        st.subheader("📚 Estudo dos erros")
        n_feitas = len(feitas)
        n_estud = int(feitas["estudada"].sum())
        frac = n_estud / n_feitas if n_feitas else 0
        st.progress(frac, text=f"{n_estud} de {n_feitas} áreas feitas com os erros já "
                               f"estudados ({frac * 100:.0f}%)")

        by_area = (feitas.assign(estud=feitas["estudada"].astype(int))
                   .groupby("area").agg(Feitas=("estud", "size"),
                                        Estudadas=("estud", "sum")).reset_index())
        by_area["Faltam"] = by_area["Feitas"] - by_area["Estudadas"]
        by_area["ordem"] = by_area["area"].map({a: i for i, a in enumerate(db.AREAS)})
        by_area = by_area.sort_values("ordem").drop(columns="ordem")
        st.dataframe(
            by_area.rename(columns={"area": "Área"}),
            hide_index=True, use_container_width=True)
        pendentes = by_area.loc[by_area["Faltam"] > 0, "Área"].tolist()
        if pendentes:
            st.caption("🟡 Ainda com erros a estudar em: " + ", ".join(pendentes))
        else:
            st.caption("✅ Você já estudou os erros de todas as áreas que fez. Mandou bem!")
