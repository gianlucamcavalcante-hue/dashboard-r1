"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold tracking-tight text-text">Não deu para abrir o painel</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Nenhum dado foi alterado. Isso costuma ser uma falha passageira na conexão com o banco de dados.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
