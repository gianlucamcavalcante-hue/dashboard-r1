import streamlit as st
import db
import seed
import theme
from views import dashboard, provas, erros

db.init_db()
seed.seed()

st.set_page_config(
    page_title="Dashboard R1",
    page_icon="🩺",
    layout="wide",
    initial_sidebar_state="collapsed",
)
theme.aplicar_estilo()

# esconde completamente a barra lateral
st.markdown(
    "<style>[data-testid='stSidebar'],[data-testid='stSidebarCollapsedControl']"
    "{display:none}</style>",
    unsafe_allow_html=True,
)

# cabeçalho + controle de meta
col_titulo, col_meta = st.columns([4, 1])
with col_titulo:
    st.title("🩺 Dashboard R1")
with col_meta:
    st.write("")
    meta = int(db.get_config("meta_percentual", 70))
    with st.popover(f"🎯 Meta: {meta}%", use_container_width=True):
        nova_meta = st.slider("Meta de acertos (%)", 50, 100, meta, 1,
                              help="Recalibra as cores em todo o painel.")
        if nova_meta != meta:
            db.set_config("meta_percentual", nova_meta)
            st.rerun()

# navegação por abas (sem menu lateral)
tab_dash, tab_provas, tab_erros = st.tabs(
    ["📊  Dashboard", "📋  Provas", "🧠  Banco de Erros"]
)

with tab_dash:
    dashboard.render()
with tab_provas:
    provas.render()
with tab_erros:
    erros.render()
