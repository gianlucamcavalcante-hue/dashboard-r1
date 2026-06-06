import streamlit as st
import pandas as pd
import plotly.express as px
import db
import theme

PLOT_LAYOUT = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(color="#c7cbdb"),
    margin=dict(l=10, r=10, t=30, b=10),
    legend=dict(bgcolor="rgba(0,0,0,0)"),
)


def render():
    provas_raw = db.listar_provas()
    if not provas_raw:
        st.warning("Nenhuma prova cadastrada. Adicione provas na aba **Provas**.")
        return

    df = pd.DataFrame([dict(r) for r in provas_raw])
    df["pct"] = (df["acertos"] / df["total_questoes"] * 100).round(1)
    df["data_feita"] = pd.to_datetime(df["data_feita"])

    meta = int(db.get_config("meta_percentual", 70))

    areas_raw = db.listar_desempenho_area()
    df_areas = pd.DataFrame([dict(r) for r in areas_raw]) if areas_raw else pd.DataFrame()

    def cor_pct(pct, meta):
        if pct >= meta:
            return "normal"
        elif pct >= meta * 0.9:
            return "off"
        return "inverse"

    # KPIs
    media = df["pct"].mean()
    melhor = df.loc[df["pct"].idxmax()]
    pior = df.loc[df["pct"].idxmin()]
    gap = media - meta

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Provas feitas", len(df))
    c2.metric("Média geral", f"{media:.1f}%",
              delta=f"{gap:+.1f}% vs meta ({meta}%)", delta_color=cor_pct(media, meta))
    c3.metric("Melhor prova", f"{melhor['pct']}%", f"{melhor['banca']} {melhor['ano']}")
    c4.metric("Pior prova", f"{pior['pct']}%", f"{pior['banca']} {pior['ano']}",
              delta_color="inverse")
    usp = df[df["banca"] == "USP-SP"]
    if not usp.empty:
        media_usp = usp["pct"].mean()
        c5.metric("Média USP-SP", f"{media_usp:.1f}%", delta=f"{media_usp - meta:+.1f}% vs meta")
    else:
        c5.metric("Média USP-SP", "—")

    st.divider()

    # análise automática de gargalo
    erros_raw = db.listar_erros()
    if erros_raw:
        df_erros = pd.DataFrame([dict(r) for r in erros_raw])
        total_erros = len(df_erros)
        exec_erros = df_erros[df_erros["tipo_erro"].isin(["interpretação", "desatenção"])]
        pct_exec = len(exec_erros) / total_erros * 100 if total_erros else 0
        if pct_exec >= 50:
            theme.banner(
                f"<b>Gargalo detectado: execução de prova.</b> "
                f"{pct_exec:.0f}% dos seus erros são de <b>interpretação</b> ou <b>desatenção</b> — "
                f"o problema não é conteúdo, é gestão de tempo e atenção durante a prova.",
                cor=theme.AMARELO,
            )

    # evolução
    st.subheader("Evolução do desempenho")
    df_sorted = df.sort_values("data_feita")
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
    fig_linha.update_xaxes(gridcolor="#232838")
    fig_linha.update_yaxes(gridcolor="#232838")
    st.plotly_chart(fig_linha, use_container_width=True)

    st.divider()

    col_a, col_b = st.columns(2)
    with col_a:
        st.subheader("Desempenho por grande área")
        if not df_areas.empty:
            df_ag = (
                df_areas.groupby("area")
                .apply(lambda x: pd.Series({"acertos": x["acertos"].sum(),
                                            "total": x["total"].sum()}))
                .reset_index()
            )
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
            fig_bar.update_xaxes(gridcolor="#232838")
            st.plotly_chart(fig_bar, use_container_width=True)
            theme.banner(f"<b>Área prioritária: {area_fraca}</b> — apenas "
                         f"{df_ag.iloc[0]['pct']}% de acerto.", cor=theme.VERMELHO, icone="🎯")
        else:
            st.info("Adicione desempenho por área ao cadastrar provas.")

    with col_b:
        st.subheader("Desempenho por banca")
        df_banca = (
            df.groupby("banca")
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
        fig_banca.update_yaxes(gridcolor="#232838")
        st.plotly_chart(fig_banca, use_container_width=True)
