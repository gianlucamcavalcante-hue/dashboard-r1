"""Estilo visual compartilhado entre as páginas."""
import streamlit as st

# Paleta
ROXO = "#6366f1"
VERDE = "#22c55e"
AMARELO = "#f59e0b"
VERMELHO = "#ef4444"
AZUL = "#38bdf8"


def aplicar_estilo():
    st.markdown(
        """
        <style>
        /* fundo geral com leve gradiente */
        .stApp {
            background: radial-gradient(1200px 600px at 20% -10%, #1b1f2e 0%, #0f1117 55%);
        }

        /* títulos */
        h1, h2, h3 { letter-spacing: -0.5px; font-weight: 700; }
        h1 { background: linear-gradient(90deg,#a5b4fc,#818cf8);
             -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

        /* cards de métrica */
        [data-testid="stMetric"] {
            background: linear-gradient(160deg,#1c2030,#161925);
            border: 1px solid #2a2f42;
            border-radius: 16px;
            padding: 18px 20px;
            box-shadow: 0 4px 18px rgba(0,0,0,0.35);
            transition: transform .15s ease, border-color .15s ease;
        }
        [data-testid="stMetric"]:hover {
            transform: translateY(-3px);
            border-color: #4f46e5;
        }
        [data-testid="stMetricValue"] { font-size: 2rem; font-weight: 700; }
        [data-testid="stMetricLabel"] p {
            font-size: .8rem; text-transform: uppercase;
            letter-spacing: 1px; color: #8b90a8;
        }

        /* botões */
        .stButton button, .stDownloadButton button {
            border-radius: 10px; font-weight: 600; border: none;
            transition: transform .1s ease, filter .1s ease;
        }
        .stButton button:hover, .stDownloadButton button:hover {
            transform: translateY(-1px); filter: brightness(1.1);
        }
        .stButton button[kind="primary"], .stDownloadButton button {
            background: linear-gradient(90deg,#6366f1,#818cf8);
        }

        /* tabelas / dataframes */
        [data-testid="stDataFrame"] {
            border-radius: 12px; overflow: hidden;
            border: 1px solid #2a2f42;
        }

        /* sidebar */
        [data-testid="stSidebar"] {
            background: #13151f;
            border-right: 1px solid #232838;
        }

        /* inputs e selects */
        .stSelectbox div[data-baseweb="select"] > div,
        .stTextInput input, .stNumberInput input, .stDateInput input {
            border-radius: 10px;
        }

        /* alertas mais suaves */
        .stAlert { border-radius: 12px; }

        /* expanders */
        [data-testid="stExpander"] {
            border: 1px solid #2a2f42; border-radius: 12px;
        }

        /* divisores discretos */
        hr { border-color: #232838; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def chip(texto, cor):
    """Devolve HTML de um 'chip' colorido."""
    return (
        f"<span style='background:{cor}22;color:{cor};"
        f"padding:4px 12px;border-radius:999px;font-weight:600;"
        f"font-size:.85rem;border:1px solid {cor}55'>{texto}</span>"
    )


def banner(texto, cor=VERMELHO, icone="⚠️"):
    st.markdown(
        f"""
        <div style="background:linear-gradient(90deg,{cor}1a,{cor}05);
                    border-left:4px solid {cor};border-radius:12px;
                    padding:16px 20px;margin:8px 0">
            <span style="font-size:1.1rem">{icone}</span>
            <span style="margin-left:8px;color:#e8eaf0">{texto}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )
