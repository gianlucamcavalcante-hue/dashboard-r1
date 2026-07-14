"""Estilo visual compartilhado entre as páginas."""
import streamlit as st

# Paleta de destaque (funciona bem em ambos os temas)
ROXO = "#6366f1"
VERDE = "#22c55e"
AMARELO = "#f59e0b"
VERMELHO = "#ef4444"
AZUL = "#38bdf8"

# Paletas de fundo/texto por tema
_PALETAS = {
    "dark": dict(
        bg="radial-gradient(1200px 600px at 20% -10%, #1b1f2e 0%, #0f1117 55%)",
        card="linear-gradient(160deg,#1c2030,#161925)",
        border="#2a2f42",
        text="#e8eaf0",
        muted="#8b90a8",
        grid="#232838",
        sidebar="#13151f",
        titulo="linear-gradient(90deg,#a5b4fc,#818cf8)",
        shadow="rgba(0,0,0,0.35)",
    ),
    "light": dict(
        bg="radial-gradient(1200px 600px at 20% -10%, #eef1fb 0%, #ffffff 55%)",
        card="linear-gradient(160deg,#ffffff,#f3f5fb)",
        border="#e1e4f0",
        text="#1a1d29",
        muted="#6b7280",
        grid="#e5e7ef",
        sidebar="#f5f6fb",
        titulo="linear-gradient(90deg,#6366f1,#4338ca)",
        shadow="rgba(99,102,241,0.08)",
    ),
}


def aplicar_estilo(modo="dark"):
    p = _PALETAS.get(modo, _PALETAS["dark"])
    st.markdown(
        f"""
        <style>
        /* fundo geral com leve gradiente */
        .stApp {{
            background: {p['bg']};
        }}

        /* títulos */
        h1, h2, h3 {{ letter-spacing: -0.5px; font-weight: 700; }}
        h1 {{ background: {p['titulo']};
             -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}

        /* cards de métrica */
        [data-testid="stMetric"] {{
            background: {p['card']};
            border: 1px solid {p['border']};
            border-radius: 16px;
            padding: 18px 20px;
            box-shadow: 0 4px 18px {p['shadow']};
            transition: transform .15s ease, border-color .15s ease;
        }}
        [data-testid="stMetric"]:hover {{
            transform: translateY(-3px);
            border-color: {ROXO};
        }}
        [data-testid="stMetricValue"] {{ font-size: 2rem; font-weight: 700; color: {p['text']}; }}
        [data-testid="stMetricLabel"] p {{
            font-size: .8rem; text-transform: uppercase;
            letter-spacing: 1px; color: {p['muted']};
        }}

        /* botões */
        .stButton button, .stDownloadButton button {{
            border-radius: 10px; font-weight: 600; border: none;
            transition: transform .1s ease, filter .1s ease;
        }}
        .stButton button:hover, .stDownloadButton button:hover {{
            transform: translateY(-1px); filter: brightness(1.1);
        }}
        .stButton button[kind="primary"], .stDownloadButton button {{
            background: linear-gradient(90deg,#6366f1,#818cf8); color: #fff;
        }}

        /* tabelas / dataframes */
        [data-testid="stDataFrame"] {{
            border-radius: 12px; overflow: hidden;
            border: 1px solid {p['border']};
        }}

        /* sidebar */
        [data-testid="stSidebar"] {{
            background: {p['sidebar']};
            border-right: 1px solid {p['border']};
        }}

        /* inputs e selects */
        .stSelectbox div[data-baseweb="select"] > div,
        .stTextInput input, .stNumberInput input, .stDateInput input, .stTextArea textarea {{
            border-radius: 10px;
        }}

        /* alertas mais suaves */
        .stAlert {{ border-radius: 12px; }}

        /* expanders */
        [data-testid="stExpander"] {{
            border: 1px solid {p['border']}; border-radius: 12px;
            background: {p['card']};
        }}

        /* divisores discretos */
        hr {{ border-color: {p['border']}; }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def palette(modo="dark"):
    """Devolve o dicionário de cores do tema escolhido."""
    return _PALETAS.get(modo, _PALETAS["dark"])


def plot_layout(modo="dark"):
    """Devolve (layout do plotly, cor da grade) para o tema escolhido."""
    p = _PALETAS.get(modo, _PALETAS["dark"])
    layout = dict(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=p["text"]),
        margin=dict(l=10, r=10, t=30, b=10),
        legend=dict(bgcolor="rgba(0,0,0,0)"),
    )
    return layout, p["grid"]


def tabela_html(df, modo="dark"):
    """Renderiza um DataFrame como tabela HTML estilizada (sem pyarrow/st.dataframe)."""
    import streamlit as _st
    p = _PALETAS.get(modo, _PALETAS["dark"])
    th = (f"padding:9px 14px;text-align:left;font-size:.82rem;font-weight:700;"
          f"text-transform:uppercase;letter-spacing:.5px;color:{p['muted']};"
          f"border-bottom:2px solid {p['border']}")
    td = (f"padding:9px 14px;text-align:left;font-size:1rem;color:{p['text']};"
          f"border-bottom:1px solid {p['border']}")
    head = "".join(f"<th style='{th}'>{c}</th>" for c in df.columns)
    linhas = ""
    for _, r in df.iterrows():
        tds = "".join(f"<td style='{td}'>{'' if v is None else v}</td>" for v in r.tolist())
        linhas += f"<tr>{tds}</tr>"
    _st.markdown(
        f"<div style='overflow-x:auto;border:1px solid {p['border']};border-radius:12px'>"
        f"<table style='width:100%;border-collapse:collapse'>"
        f"<thead><tr>{head}</tr></thead><tbody>{linhas}</tbody></table></div>",
        unsafe_allow_html=True,
    )


def chip(texto, cor):
    """Devolve HTML de um 'chip' colorido."""
    return (
        f"<span style='background:{cor}22;color:{cor};"
        f"padding:4px 12px;border-radius:999px;font-weight:600;"
        f"font-size:.85rem;border:1px solid {cor}55'>{texto}</span>"
    )


def banner(texto, cor=VERMELHO, icone="⚠️", modo="dark"):
    p = _PALETAS.get(modo, _PALETAS["dark"])
    st.markdown(
        f"""
        <div style="background:linear-gradient(90deg,{cor}1a,{cor}05);
                    border-left:4px solid {cor};border-radius:12px;
                    padding:16px 20px;margin:8px 0">
            <span style="font-size:1.1rem">{icone}</span>
            <span style="margin-left:8px;color:{p['text']}">{texto}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )
