"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { AMARELO, AZUL, ROXO, SERIES, VERMELHO, useCores } from "./comum";
import {
  BANCA_FOCO,
  dataBR,
  fmtPct,
  mesAnoCurto,
  type AreaAgregada,
  type BancaArea,
  type BancaMedia,
  type PontoArea,
  type SerieBanca,
} from "@/lib/calc";

function Caixa({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">{children}</div>
  );
}

/** Ticks de 0 a 100 de 20 em 20. */
const TICKS_100 = [0, 20, 40, 60, 80, 100];

function rotuloMeta(meta: number, pos: "insideBottomRight" | "insideTopLeft" | "insideTopRight" = "insideBottomRight") {
  return { value: `Meta ${meta}%`, position: pos, fill: AMARELO, fontSize: 11 };
}

/* ---------------- evolução geral (uma linha por banca) ---------------- */

export function GraficoEvolucao({ series, meta }: { series: SerieBanca[]; meta: number }) {
  const c = useCores();
  const todos = series.flatMap((s) => s.pontos.map((p) => p.t));
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const folga = Math.max((max - min) * 0.04, 86400000 * 5);
  return (
    <div className="h-[320px] sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.grade} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[min - folga, max + folga]}
            tickFormatter={mesAnoCurto}
            tick={{ fill: c.muted, fontSize: 12 }}
            stroke={c.grade}
            allowDuplicatedCategory={false}
          />
          <YAxis domain={[0, 100]} ticks={TICKS_100} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grade} unit="%" />
          <ReferenceLine y={meta} stroke={AMARELO} strokeDasharray="6 4" label={rotuloMeta(meta)} />
          <Tooltip
            cursor={{ stroke: c.grade }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload;
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">
                    {p.banca} {p.ano}
                  </div>
                  <div className="text-muted">{mesAnoCurto(p.t)}</div>
                  <div className="num mt-1">
                    {fmtPct(p.pct)} · {p.acertos}/{p.total}
                  </div>
                </Caixa>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: c.muted, paddingTop: 8 }} />
          {series.map((s, i) => (
            <Line
              key={s.banca}
              data={s.pontos}
              dataKey="pct"
              name={s.banca}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={3}
              dot={{ r: 5, strokeWidth: 0, fill: SERIES[i % SERIES.length] }}
              activeDot={{ r: 7 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- barras por área (horizontal, pior em vermelho) ---------------- */

export function GraficoAreas({ dados, meta }: { dados: AreaAgregada[]; meta: number }) {
  const c = useCores();
  const pior = dados[0]?.area;
  return (
    <div style={{ height: Math.max(220, dados.length * 46 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={c.grade} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} ticks={TICKS_100} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grade} unit="%" />
          <YAxis
            type="category"
            dataKey="area"
            width={104}
            tick={{ fill: c.texto, fontSize: 12 }}
            stroke={c.grade}
            tickLine={false}
          />
          <ReferenceLine x={meta} stroke={AMARELO} strokeDasharray="6 4" />
          <Tooltip
            cursor={{ fill: c.grade, opacity: 0.4 }}
            content={({ active, payload }) => {
              const p = active && (payload?.[0]?.payload as AreaAgregada | undefined);
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">{p.area}</div>
                  <div className="num">
                    {fmtPct(p.pct)} · {p.acertos}/{p.total}
                  </div>
                </Caixa>
              );
            }}
          />
          <Bar dataKey="pct" radius={[0, 6, 6, 0]} maxBarSize={30} isAnimationActive={false}>
            {dados.map((d) => (
              <Cell key={d.area} fill={d.area === pior ? VERMELHO : ROXO} />
            ))}
            <LabelList dataKey="pct" position="right" formatter={(v: number) => fmtPct(v)} fill={c.texto} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- barras por banca (USP-SP em destaque) ---------------- */

export function GraficoBancas({
  dados,
  meta,
}: {
  dados: (BancaMedia | BancaArea)[];
  meta: number;
}) {
  const c = useCores();
  const linhas = dados.map((d) => ({ ...d, valor: "media" in d ? d.media : d.pct }));
  return (
    <div style={{ height: Math.max(200, linhas.length * 44 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={linhas} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={c.grade} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} ticks={TICKS_100} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grade} unit="%" />
          <YAxis
            type="category"
            dataKey="banca"
            width={128}
            tick={{ fill: c.texto, fontSize: 12 }}
            stroke={c.grade}
            tickLine={false}
          />
          <ReferenceLine x={meta} stroke={AMARELO} strokeDasharray="6 4" />
          <Tooltip
            cursor={{ fill: c.grade, opacity: 0.4 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload;
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">{p.banca}</div>
                  <div className="num">
                    {fmtPct(p.valor)} · {p.provas} prova{p.provas > 1 ? "s" : ""}
                  </div>
                </Caixa>
              );
            }}
          />
          <Bar dataKey="valor" radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive={false}>
            {linhas.map((d) => (
              <Cell key={d.banca} fill={d.banca === BANCA_FOCO ? AMARELO : AZUL} />
            ))}
            <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtPct(v)} fill={c.texto} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- evolução de uma área ---------------- */

export function GraficoEvolucaoArea({ pontos, meta, area }: { pontos: PontoArea[]; meta: number; area: string }) {
  const c = useCores();
  const min = pontos[0]!.t;
  const max = pontos[pontos.length - 1]!.t;
  const folga = Math.max((max - min) * 0.04, 86400000 * 5);
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.grade} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[min - folga, max + folga]}
            tickFormatter={mesAnoCurto}
            tick={{ fill: c.muted, fontSize: 12 }}
            stroke={c.grade}
          />
          <YAxis domain={[0, 100]} ticks={TICKS_100} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grade} unit="%" />
          <ReferenceLine y={meta} stroke={AMARELO} strokeDasharray="6 4" label={rotuloMeta(meta)} />
          <Tooltip
            cursor={{ stroke: c.grade }}
            content={({ active, payload }) => {
              const p = active && (payload?.[0]?.payload as PontoArea | undefined);
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">{p.rotulo}</div>
                  <div className="text-muted">{dataBR(p.data)}</div>
                  <div className="num mt-1">
                    {area}: {fmtPct(p.pct)} · {p.acertos}/{p.total}
                  </div>
                </Caixa>
              );
            }}
          />
          <Line
            dataKey="pct"
            stroke={ROXO}
            strokeWidth={3}
            dot={{ r: 5.5, strokeWidth: 0, fill: ROXO }}
            activeDot={{ r: 7 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
