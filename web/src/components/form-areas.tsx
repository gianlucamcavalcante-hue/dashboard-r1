"use client";

import { classeCampo, corFaixa } from "./comum";
import { AREAS, FIZ, NAO_FIZ, faixa, fmtPct, pct, type Area } from "@/lib/calc";

/** Uma linha do formulário: os números ficam como texto enquanto a pessoa digita. */
export interface LinhaArea {
  area: string;
  status: string;
  acertos: string;
  total: string;
  estudada: boolean;
}

export function linhasVazias(): LinhaArea[] {
  return AREAS.map((area) => ({ area, status: FIZ, acertos: "", total: "", estudada: false }));
}

export function linhasDe(ap: Area[]): LinhaArea[] {
  return AREAS.map((area) => {
    const a = ap.find((x) => x.area === area);
    return a
      ? { area, status: a.status, acertos: String(a.acertos), total: String(a.total), estudada: a.estudada }
      : { area, status: FIZ, acertos: "", total: "", estudada: false };
  });
}

/** Converte para o formato que vai ao banco (vazio = 0). */
export function paraSalvar(linhas: LinhaArea[]) {
  return linhas.map((l) => ({
    area: l.area,
    status: l.status,
    acertos: l.acertos.trim() === "" ? 0 : Number(l.acertos),
    total: l.total.trim() === "" ? 0 : Number(l.total),
    estudada: l.status === FIZ ? l.estudada : false,
  }));
}

/** Confere antes de mandar: devolve a mensagem de erro ou null. */
export function conferir(linhas: LinhaArea[]): string | null {
  for (const l of paraSalvar(linhas)) {
    if (!Number.isInteger(l.acertos) || !Number.isInteger(l.total) || l.acertos < 0 || l.total < 0)
      return `${l.area}: use números inteiros.`;
    if (l.status === FIZ && l.acertos > l.total) return `${l.area}: acertos não pode ser maior que total.`;
  }
  return null;
}

export function FormAreas({
  linhas,
  onChange,
  comEstudo,
  meta,
}: {
  linhas: LinhaArea[];
  onChange: (l: LinhaArea[]) => void;
  comEstudo: boolean;
  meta: number;
}) {
  const muda = (i: number, campo: Partial<LinhaArea>) =>
    onChange(linhas.map((l, j) => (j === i ? { ...l, ...campo } : l)));

  const soNumero = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1.6fr_1.1fr_.8fr_.8fr_.7fr_1fr] gap-2 px-1 text-xs font-medium text-muted sm:grid">
        <span>Área</span>
        <span>Fiz?</span>
        <span>Acertos</span>
        <span>Total</span>
        <span className="text-right">%</span>
        <span>{comEstudo ? "Erros" : ""}</span>
      </div>
      {linhas.map((l, i) => {
        const fez = l.status === FIZ;
        const v = fez ? pct(Number(l.acertos || 0), Number(l.total || 0)) : null;
        const passou = fez && l.total !== "" && Number(l.acertos || 0) > Number(l.total);
        return (
          <div
            key={l.area}
            className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-border bg-card2 p-2.5 sm:grid-cols-[1.6fr_1.1fr_.8fr_.8fr_.7fr_1fr] sm:border-0 sm:bg-transparent sm:p-1"
          >
            <span className="text-sm font-medium">{l.area}</span>
            <select
              aria-label={`${l.area}: fiz ou não fiz`}
              value={l.status}
              onChange={(e) => muda(i, { status: e.target.value })}
              className={`${classeCampo} w-auto sm:w-full`}
            >
              <option value={FIZ}>Fiz</option>
              <option value={NAO_FIZ}>Não fiz</option>
            </select>
            <div className="col-span-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2 sm:contents">
              <input
                aria-label={`${l.area}: acertos`}
                inputMode="numeric"
                placeholder="Acertos"
                value={l.acertos}
                disabled={!fez}
                onChange={(e) => muda(i, { acertos: soNumero(e.target.value) })}
                className={`${classeCampo} num ${passou ? "!border-neg" : ""}`}
              />
              <input
                aria-label={`${l.area}: total`}
                inputMode="numeric"
                placeholder="Total"
                value={l.total}
                disabled={!fez}
                onChange={(e) => muda(i, { total: soNumero(e.target.value) })}
                className={`${classeCampo} num`}
              />
              <span
                className={`num w-14 text-right text-sm font-semibold ${
                  passou ? "text-neg" : v === null ? "text-faint" : corFaixa(faixa(v, meta))
                }`}
                title={passou ? "Acertos maior que o total" : undefined}
              >
                {passou ? "confira" : v === null ? "—" : fmtPct(v)}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              {comEstudo && fez && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={l.estudada}
                    onChange={(e) => muda(i, { estudada: e.target.checked })}
                    className="h-4 w-4 accent-[#3a6aa5]"
                  />
                  📚 estudei
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
