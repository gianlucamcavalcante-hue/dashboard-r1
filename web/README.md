# Dashboard R1 (versão Vercel)

Painel das provas de residência, em Next.js, publicado na Vercel (projeto `dashboard-r1`, pasta raiz `web`).
Lê o mesmo banco Supabase do app antigo em Streamlit (raiz deste repositório).

- Publicar: basta enviar para a branch `main`; a Vercel publica sozinha.
- Variáveis na Vercel: `DATABASE_URL` (Supabase, porta 6543) e `DASHBOARD_PASSWORD` (senha de entrada).
- Contas do painel: `src/lib/calc.ts` (com testes em `src/lib/__tests__`).
- Rodar no computador: `npm run dev` dentro de `web/`, com `DATABASE_URL` em `web/.env.local`.
- Se a Vercel parar de publicar sozinha: Settings → Git → Disconnect e conectar de novo o repositório (já aconteceu uma vez).
