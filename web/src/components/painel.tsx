"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Botao, TemaCtx, useTemaEstado } from "./comum";
import Dashboard from "./dashboard";
import Provas from "./provas";
import DiagnosticoFoco from "./foco";
import { salvarMeta } from "@/server/acoes";
import { BANCA_FOCO, type Area, type Prova } from "@/lib/calc";

type Aba = "dashboard" | "provas";
type Foco = "usp" | "todas";

export default function Painel({
  provas,
  areas,
  meta,
  dataProva,
  comSenha,
}: {
  provas: Prova[];
  areas: Area[];
  meta: number;
  dataProva: string | null;
  comSenha: boolean;
}) {
  const temaEstado = useTemaEstado();
  const [aba, setAba] = useState<Aba>("dashboard");
  const [foco, setFoco] = useState<Foco>("usp");

  // lembra a última aba e o modo escolhidos neste aparelho
  useEffect(() => {
    try {
      const a = localStorage.getItem("aba");
      if (a === "provas" || a === "dashboard") setAba(a);
      const f = localStorage.getItem("foco");
      if (f === "usp" || f === "todas") setFoco(f);
    } catch {
      /* sem armazenamento */
    }
  }, []);
  const trocarFoco = (f: Foco) => {
    setFoco(f);
    try {
      localStorage.setItem("foco", f);
    } catch {
      /* sem armazenamento */
    }
  };
  const trocarAba = (a: Aba) => {
    setAba(a);
    try {
      localStorage.setItem("aba", a);
    } catch {
      /* sem armazenamento */
    }
  };

  return (
    <TemaCtx.Provider value={temaEstado}>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span aria-hidden>🩺 </span>Dashboard R1
          </h1>
          <div className="flex items-center gap-2">
            <ControleMeta meta={meta} />
            <button
              onClick={() => temaEstado.setTema(temaEstado.tema === "dark" ? "light" : "dark")}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-card2"
              title="Alternar claro/escuro"
              aria-label="Alternar claro/escuro"
            >
              {temaEstado.tema === "dark" ? "☀️" : "🌙"}
            </button>
            {comSenha && (
              <form action="/api/logout" method="post">
                <button className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted hover:bg-card2">
                  Sair
                </button>
              </form>
            )}
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-border bg-card p-1" role="radiogroup" aria-label="O que analisar">
            {(
              [
                ["usp", `🎯 Foco ${BANCA_FOCO}`],
                ["todas", "Todas as provas"],
              ] as const
            ).map(([id, texto]) => (
              <button
                key={id}
                role="radio"
                aria-checked={foco === id}
                onClick={() => trocarFoco(id)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  foco === id ? "bg-accent text-white shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">
            {foco === "usp"
              ? `Analisando só as provas da ${BANCA_FOCO}.`
              : "Analisando todas as bancas juntas."}
          </span>
        </div>

        <nav className="mt-5 flex gap-1 border-b border-border" role="tablist">
          {(
            [
              ["dashboard", "📊 Dashboard"],
              ["provas", "📋 Provas"],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              role="tab"
              aria-selected={aba === id}
              onClick={() => trocarAba(id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                aba === id ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {texto}
            </button>
          ))}
        </nav>

        <main className="mt-6">
          {aba === "dashboard" ? (
            foco === "usp" ? (
              <DiagnosticoFoco provas={provas} areas={areas} meta={meta} dataProva={dataProva} />
            ) : (
              <Dashboard provas={provas} areas={areas} meta={meta} />
            )
          ) : (
            <Provas provas={provas} areas={areas} meta={meta} soFoco={foco === "usp"} />
          )}
        </main>
      </div>
    </TemaCtx.Provider>
  );
}

/** Botão "🎯 Meta: 70%" que abre um controle para mudar a meta. */
function ControleMeta({ meta }: { meta: number }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(meta);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => setValor(meta), [meta]);

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const salvar = () =>
    start(async () => {
      const r = await salvarMeta(valor);
      if (r.ok) {
        setErro(null);
        setAberto(false);
      } else setErro(r.erro);
    });

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto((a) => !a)}
        className="num rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-card2"
        aria-expanded={aberto}
      >
        🎯 Meta: {meta}%
      </button>
      {aberto && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Meta de acertos</span>
            <span className="num text-lg font-semibold">{valor}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
            className="mt-3 w-full accent-[#6366f1]"
            aria-label="Meta de acertos"
          />
          <p className="mt-1 text-xs text-muted">Recalibra as cores em todo o painel.</p>
          <div className="mt-3 flex gap-2">
            <Botao onClick={salvar} disabled={salvando || valor === meta}>
              {salvando ? "Salvando…" : "Salvar"}
            </Botao>
            <Botao tipo="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
          </div>
          {erro && <p className="mt-2 text-xs text-neg">{erro}</p>}
        </div>
      )}
    </div>
  );
}
