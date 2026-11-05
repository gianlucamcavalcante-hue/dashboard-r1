export default function Login({ searchParams }: { searchParams: { erro?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action="/api/login"
        method="post"
        className="w-full max-w-xs rounded-2xl border border-border bg-card p-6"
      >
        <h1 className="text-lg font-semibold tracking-tight text-text">🩺 Dashboard R1</h1>
        <p className="mt-1 text-sm text-muted">Digite sua senha para entrar.</p>
        <input
          type="password"
          name="senha"
          autoFocus
          placeholder="Senha"
          className="mt-4 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-faint"
        />
        {searchParams?.erro && (
          <p className="mt-2 text-xs text-neg">
            {searchParams.erro === "limite" ? "Muitas tentativas. Espere 15 minutos." : "Senha incorreta."}
          </p>
        )}
        <button className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
          Entrar
        </button>
      </form>
    </main>
  );
}
