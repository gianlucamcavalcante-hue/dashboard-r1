"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/* ---------------- cores ---------------- */

export const ROXO = "#6366f1";
export const VERDE = "#22c55e";
export const AMARELO = "#f59e0b";
export const VERMELHO = "#ef4444";
export const AZUL = "#38bdf8";
/** Uma cor por banca nas linhas de evolução. */
export const SERIES = ["#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf"];

export interface CoresTema {
  texto: string;
  muted: string;
  grade: string;
  card: string;
  borda: string;
}

const CLARO: CoresTema = { texto: "#1a1d29", muted: "#5f6577", grade: "#e5e7ef", card: "#ffffff", borda: "#e1e4f0" };
const ESCURO: CoresTema = { texto: "#e8eaf0", muted: "#9ba0b8", grade: "#262b3d", card: "#171a26", borda: "#2a2f42" };

export type Tema = "light" | "dark";
export const TemaCtx = createContext<{ tema: Tema; setTema: (t: Tema) => void }>({
  tema: "light",
  setTema: () => {},
});

/** Lê o tema que o layout já aplicou na página e permite trocar. */
export function useTemaEstado() {
  const [tema, setTemaSt] = useState<Tema>("light");
  useEffect(() => {
    setTemaSt(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);
  const setTema = (t: Tema) => {
    setTemaSt(t);
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem("tema", t);
    } catch {
      /* navegador sem armazenamento: só não lembra */
    }
  };
  return { tema, setTema };
}

export function useCores(): CoresTema {
  return useContext(TemaCtx).tema === "dark" ? ESCURO : CLARO;
}

/** Cor da nota frente à meta. */
export function corFaixa(f: "bom" | "perto" | "ruim"): string {
  return f === "bom" ? "text-pos" : f === "perto" ? "text-warn" : "text-neg";
}

/* ---------------- blocos ---------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Secao({
  titulo,
  sub,
  children,
  acao,
}: {
  titulo: string;
  sub?: ReactNode;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function Metrica({
  rotulo,
  valor,
  detalhe,
  corDetalhe = "text-muted",
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  corDetalhe?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{rotulo}</div>
      <div className="num mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">{valor}</div>
      {detalhe && <div className={`num mt-1 text-sm ${corDetalhe}`}>{detalhe}</div>}
    </div>
  );
}

export function Aviso({
  children,
  cor = VERMELHO,
  icone = "🎯",
}: {
  children: ReactNode;
  cor?: string;
  icone?: string;
}) {
  return (
    <div
      className="mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
      style={{ background: `${cor}14`, borderLeft: `4px solid ${cor}` }}
    >
      <span aria-hidden>{icone}</span>
      <span>{children}</span>
    </div>
  );
}

export function Info({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-border bg-card2 px-4 py-3 text-sm text-muted">{children}</div>;
}

export function Chip({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${cor}1f`, color: cor, border: `1px solid ${cor}55` }}
    >
      {texto}
    </span>
  );
}

export function Tabela({
  colunas,
  linhas,
  alinharDireita = [],
}: {
  colunas: string[];
  linhas: ReactNode[][];
  alinharDireita?: number[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {colunas.map((c, i) => (
              <th
                key={c}
                className={`whitespace-nowrap border-b border-border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-4 ${
                  alinharDireita.includes(i) ? "text-right" : "text-left"
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {l.map((v, j) => (
                <td
                  key={j}
                  className={`num px-3 py-2.5 sm:px-4 ${alinharDireita.includes(j) ? "text-right" : "text-left"}`}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Caixa de seleção no estilo do painel. */
export function Selecao<T extends string | number>({
  rotulo,
  valor,
  opcoes,
  onChange,
  className = "",
}: {
  rotulo?: string;
  valor: T;
  opcoes: { valor: T; texto: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      {rotulo && <span className="mb-1 block text-xs font-medium text-muted">{rotulo}</span>}
      <select
        value={String(valor)}
        onChange={(e) => {
          const op = opcoes.find((o) => String(o.valor) === e.target.value);
          if (op) onChange(op.valor);
        }}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-accent"
      >
        {opcoes.map((o) => (
          <option key={String(o.valor)} value={String(o.valor)}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export const classeCampo =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-40";

export function Botao({
  children,
  onClick,
  tipo = "primario",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: "primario" | "secundario" | "perigo";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls =
    tipo === "primario"
      ? "bg-accent text-white hover:opacity-90"
      : tipo === "perigo"
        ? "bg-neg text-white hover:opacity-90"
        : "border border-border bg-card text-text hover:bg-card2";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

/** Bloco que abre e fecha (como os "expanders" do app antigo). */
export function Recolhivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group mt-3 rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium sm:px-5">
        {titulo}
        <span className="text-muted transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}

/** Mensagem curta de resultado (salvo / erro). */
export function Mensagem({ msg }: { msg: { tipo: "ok" | "erro"; texto: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`mt-3 text-sm ${msg.tipo === "ok" ? "text-pos" : "text-neg"}`} role="status">
      {msg.texto}
    </p>
  );
}
