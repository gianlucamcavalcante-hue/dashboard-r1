"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
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
import { AMARELO, AZUL, LARANJA, MARINHO, SERIES, useCores } from "./comum";
import {
  BANCA_FOCO,
  dataBR,
  fmtPct,
  mesAnoCurto,
  type AreaAgregada,
  type BancaArea,
  type BancaMedia,
  type BarraPareto,
  type PontoArea,
  type PontoTempo,
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
              <Cell key={d.area} fill={d.area === pior ? LARANJA : MARINHO} />
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
            stroke={MARINHO}
            strokeWidth={3}
            dot={{ r: 5.5, strokeWidth: 0, fill: MARINHO }}
            activeDot={{ r: 7 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- mini gráfico de uma área (cartões do foco) ---------------- */

export function GraficoMini({ pontos, meta, cor }: { pontos: PontoArea[]; meta: number; cor: string }) {
  const c = useCores();
  return (
    <div className="h-[72px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
          <YAxis domain={[0, 100]} hide />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
          <ReferenceLine y={meta} stroke={AMARELO} strokeDasharray="4 3" />
          <Tooltip
            cursor={{ stroke: c.grade }}
            content={({ active, payload }) => {
              const p = active && (payload?.[0]?.payload as PontoArea | undefined);
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">{p.rotulo}</div>
                  <div className="num">
                    {fmtPct(p.pct)} · {p.acertos}/{p.total}
                  </div>
                </Caixa>
              );
            }}
          />
          <Line
            dataKey="pct"
            stroke={cor}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: cor }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- radar: equilíbrio entre as áreas ---------------- */

export function GraficoRadar({ dados }: { dados: { area: string; atual: number; meta: number }[] }) {
  const c = useCores();
  const curto: Record<string, string> = {
    "Clínica Médica": "Clínica",
    Cirurgia: "Cirurgia",
    Pediatria: "Pediatria",
    Ginecologia: "Gineco",
    Obstetrícia: "Obstetrícia",
    Preventiva: "Preventiva",
  };
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={dados} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke={c.grade} />
          <PolarAngleAxis dataKey="area" tickFormatter={(v: string) => curto[v] ?? v} tick={{ fill: c.texto, fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={6} tick={{ fill: c.muted, fontSize: 10 }} axisLine={false} angle={90} />
          <Radar name="Sua meta" dataKey="meta" stroke={AMARELO} strokeDasharray="5 4" fill={AMARELO} fillOpacity={0.08} isAnimationActive={false} />
          <Radar name="Fase atual" dataKey="atual" stroke={MARINHO} strokeWidth={2.5} fill={MARINHO} fillOpacity={0.28} isAnimationActive={false} />
          <Legend wrapperStyle={{ fontSize: 12, color: c.muted }} />
          <Tooltip
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload;
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">{p.area}</div>
                  <div className="num">
                    fase atual {fmtPct(p.atual)} · meta {p.meta}%
                  </div>
                </Caixa>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- evolução: ordem em que fiz × ano da prova ---------------- */

export function GraficoTempo({ pontos, meta, modo }: { pontos: PontoTempo[]; meta: number; modo: "ordem" | "ano" }) {
  const c = useCores();
  const dados = modo === "ordem" ? pontos : [...pontos].sort((a, b) => a.ano - b.ano || a.t - b.t);
  const x = modo === "ordem" ? "t" : "ano";
  const xs = dados.map((p) => (modo === "ordem" ? p.t : p.ano));
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const folga = modo === "ordem" ? Math.max((max - min) * 0.04, 86400000 * 5) : 0.5;
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.grade} vertical={false} />
          <ReferenceArea y1={meta} y2={100} fill={VERDE_FAIXA} fillOpacity={0.08} ifOverflow="hidden" />
          <XAxis
            dataKey={x}
            type="number"
            domain={[min - folga, max + folga]}
            ticks={modo === "ano" ? [...new Set(xs)] : undefined}
            tickFormatter={(v: number) => (modo === "ordem" ? mesAnoCurto(v) : String(v))}
            tick={{ fill: c.muted, fontSize: 12 }}
            stroke={c.grade}
            allowDecimals={false}
          />
          <YAxis domain={[0, 100]} ticks={TICKS_100} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grade} unit="%" />
          <ReferenceLine y={meta} stroke={AMARELO} strokeDasharray="6 4" label={rotuloMeta(meta)} />
          <Tooltip
            cursor={{ stroke: c.grade }}
            content={({ active, payload }) => {
              const p = active && (payload?.[0]?.payload as PontoTempo | undefined);
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">{p.rotulo}</div>
                  <div className="text-muted">feita em {mesAnoCurto(p.t)}</div>
                  <div className="num mt-1">
                    nota {fmtPct(p.pct)}
                    {modo === "ordem" && <> · média móvel {fmtPct(p.movel)}</>}
                  </div>
                </Caixa>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: c.muted, paddingTop: 8 }} />
          <Line
            dataKey="pct"
            name={modo === "ordem" ? "Nota de cada prova" : "Nota (pelo ano da prova)"}
            stroke={modo === "ordem" ? "#94a3b8" : MARINHO}
            strokeWidth={modo === "ordem" ? 1.5 : 2.5}
            dot={{ r: 5, strokeWidth: 0, fill: modo === "ordem" ? "#94a3b8" : MARINHO }}
            activeDot={{ r: 7 }}
            isAnimationActive={false}
          />
          {modo === "ordem" && (
            <Line
              dataKey="movel"
              name="Média móvel (3 provas)"
              stroke={MARINHO}
              strokeWidth={3.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const VERDE_FAIXA = "#22c55e";

/* ---------------- pareto: o que mais te faz errar ---------------- */

export function GraficoPareto({ dados }: { dados: BarraPareto[] }) {
  const c = useCores();
  return (
    <div style={{ height: Math.max(180, dados.length * 38 + 50) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 70, bottom: 0, left: 4 }}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="texto"
            width={170}
            tick={{ fill: c.texto, fontSize: 12 }}
            stroke={c.grade}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: c.grade, opacity: 0.4 }}
            content={({ active, payload }) => {
              const p = active && (payload?.[0]?.payload as BarraPareto | undefined);
              if (!p) return null;
              return (
                <Caixa>
                  <div className="font-semibold">{p.texto}</div>
                  <div className="num">
                    {p.n} erro{p.n > 1 ? "s" : ""} · {fmtPct(p.pct)} · acumulado {fmtPct(p.acumulado)}
                  </div>
                </Caixa>
              );
            }}
          />
          <Bar dataKey="n" radius={[0, 6, 6, 0]} maxBarSize={24} isAnimationActive={false}>
            {dados.map((d, i) => (
              <Cell key={d.chave} fill={i === 0 ? MARINHO : "#7f9cc4"} />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              formatter={(v: number) => fmtPct(v)}
              fill={c.texto}
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
