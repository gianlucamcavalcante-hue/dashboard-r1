"use client";

import { useState, useTransition } from "react";
import { AMARELO, Botao, Card, Chip, Info, Metrica, ROXO, Secao, VERDE, VERMELHO, classeCampo, corFaixa } from "./comum";
import { GraficoEvolucao, GraficoMini } from "./graficos";
import { EstudoErros } from "./dashboard";
import { salvarDataProva } from "@/server/acoes";
import {
  AREAS,
  BANCA_FOCO,
  N_RECENTES,
  dataBR,
  diagnostico,
  diasAte,
  evolucaoDaArea,
  evolucaoPorBanca,
  faixa,
  filtrarBanca,
  fmtNum1,
  fmtPct,
  fmtSinal,
  mesAno,
  type Area,
  type DiagArea,
  type Diagnostico,
  type Prova,
} from "@/lib/calc";

const COR_FAIXA = { bom: VERDE, perto: AMARELO, ruim: VERMELHO } as const;

/** Painel do modo foco: tudo só com as provas da banca-alvo (USP-SP). */
export default function DiagnosticoFoco({
  provas,
  areas,
  meta,
  dataProva,
}: {
  provas: Prova[];
  areas: Area[];
  meta: number;
  dataProva: string | null;
}) {
  const d = diagnostico(provas, areas, meta);
  const foco = filtrarBanca(provas, areas, BANCA_FOCO);

  if (!d) {
    return <Info>Você ainda não cadastrou nenhuma prova da {BANCA_FOCO}. Adicione na aba Provas.</Info>;
  }

  const series = evolucaoPorBanca(foco.provas, foco.areas);

  return (
    <div>
      <Contagem dataProva={dataProva} />

      {/* números do topo */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          rotulo={`Média ${BANCA_FOCO}`}
          valor={d.media === null ? "—" : fmtPct(d.media)}
          detalhe={d.media === null ? "nenhuma prova completa" : `${fmtSinal(d.media - meta)} pts vs meta · ${d.nCompletas} provas`}
          corDetalhe={d.media === null ? "text-muted" : corFaixa(faixa(d.media, meta))}
        />
        <Metrica
          rotulo={`Fase atual (últimas ${Math.min(N_RECENTES, d.nCompletas)})`}
          valor={d.pctRecente === null ? "—" : fmtPct(d.pctRecente)}
          detalhe={
            d.tendencia === null
              ? "faça mais provas para comparar"
              : `${d.tendencia > 0 ? "▲" : d.tendencia < 0 ? "▼" : "="} ${fmtSinal(d.tendencia)} pts vs antes`
          }
          corDetalhe={d.tendencia === null ? "text-muted" : d.tendencia > 0 ? "text-pos" : d.tendencia < 0 ? "text-neg" : "text-muted"}
        />
        <Metrica
          rotulo="Última prova"
          valor={d.ultima ? fmtPct(d.ultima.pct) : "—"}
          detalhe={d.ultima ? `${d.ultima.banca} ${d.ultima.ano} · ${mesAno(d.ultima.data_feita)}` : undefined}
          corDetalhe={d.ultima ? corFaixa(faixa(d.ultima.pct, meta)) : undefined}
        />
        <Metrica
          rotulo={`Para a meta de ${meta}%`}
          valor={d.faltam > 0 ? `+${fmtNum1(Math.ceil(d.faltam))} questões` : "Meta batida ✓"}
          detalhe={d.faltam > 0 ? `a mais por prova (de ~${d.questoesProva})` : "na fase atual"}
          corDetalhe={d.faltam > 0 ? "text-muted" : "text-pos"}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Só provas da {BANCA_FOCO}. &quot;Fase atual&quot; = suas {N_RECENTES} provas mais recentes, que mostram melhor
        como você está hoje do que a média de tudo.
      </p>

      <Prioridades d={d} meta={meta} />
      <Plano d={d} meta={meta} />

      <Secao titulo={`Evolução na ${BANCA_FOCO}`} sub="Cada ponto é uma prova, na data em que você fez.">
        <Card>
          <GraficoEvolucao series={series} meta={meta} />
        </Card>
      </Secao>

      <Secao titulo={`Cada área na ${BANCA_FOCO}`} sub="Linha tracejada = sua meta. Número grande = fase atual.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {AREAS.map((ar) => {
            const da = d.areas.find((x) => x.area === ar);
            const pts = evolucaoDaArea(ar, foco.areas, foco.provas);
            if (!da || pts.length === 0) {
              return (
                <Card key={ar}>
                  <div className="text-sm font-medium">{ar}</div>
                  <div className="mt-2 text-sm text-muted">Sem notas ainda.</div>
                </Card>
              );
            }
            const f = faixa(da.pctRecente, meta);
            return (
              <div key={ar} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{ar}</span>
                  <Seta v={da.tendencia} />
                </div>
                <div className={`num mt-1 text-2xl font-semibold ${corFaixa(f)}`}>{fmtPct(da.pctRecente)}</div>
                <GraficoMini pontos={pts} meta={meta} cor={COR_FAIXA[f]} />
              </div>
            );
          })}
        </div>
      </Secao>

      <EstudoErros areas={foco.areas} />
    </div>
  );
}

function Seta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-xs text-faint">—</span>;
  const cls = v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-muted";
  return (
    <span className={`num whitespace-nowrap text-xs font-medium ${cls}`} title="Fase atual comparada com as provas anteriores">
      {v > 0 ? "▲" : v < 0 ? "▼" : "="} {fmtSinal(v)} pts
    </span>
  );
}

/* ---------------- ranking: onde ganhar pontos ---------------- */

function Prioridades({ d, meta }: { d: Diagnostico; meta: number }) {
  const prioridades = d.areas.filter((a) => a.ganho > 0).slice(0, 2).map((a) => a.area);
  return (
    <Secao
      titulo="🎯 Onde você ganha mais pontos"
      sub={`Da área que mais rende para a que menos rende. "Questões a ganhar" = quantas questões a mais por prova você precisa nessa área para chegar em ${meta}%, já pesando quantas questões ela tem na prova.`}
    >
      <Card className="!p-0">
        <div className="hidden grid-cols-[1.6rem_8.5rem_1fr_4.5rem_5.5rem_7rem] items-center gap-3 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted md:grid">
          <span>#</span>
          <span>Área</span>
          <span>Fase atual × meta</span>
          <span className="text-right">Geral</span>
          <span className="text-right">Tendência</span>
          <span className="text-right">A ganhar</span>
        </div>
        {d.areas.map((a, i) => (
          <LinhaPrioridade key={a.area} a={a} i={i} meta={meta} destaque={prioridades.includes(a.area)} />
        ))}
      </Card>
    </Secao>
  );
}

function LinhaPrioridade({ a, i, meta, destaque }: { a: DiagArea; i: number; meta: number; destaque: boolean }) {
  const f = faixa(a.pctRecente, meta);
  const barra = (
    <div className="relative h-2.5 w-full rounded-full bg-card2">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, a.pctRecente)}%`, background: COR_FAIXA[f] }}
      />
      <div className="absolute -inset-y-1 w-0.5 rounded bg-gold" style={{ left: `${meta}%` }} title={`Meta ${meta}%`} />
    </div>
  );
  return (
    <div
      className={`grid grid-cols-[1.6rem_1fr_auto] items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 last:border-0 md:grid-cols-[1.6rem_8.5rem_1fr_4.5rem_5.5rem_7rem] md:px-5 ${
        destaque ? "bg-neg/[0.04]" : ""
      }`}
    >
      <span className="num text-sm font-semibold text-muted">{i + 1}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{a.area}</div>
        {destaque && (
          <div className="mt-0.5">
            <Chip texto="Prioridade" cor={VERMELHO} />
          </div>
        )}
      </div>
      {/* no celular, "a ganhar" fica na mesma linha do nome */}
      <span className="text-right md:hidden">
        <Ganho a={a} />
      </span>
      <div className="col-span-3 flex items-center gap-3 md:col-span-1">
        <span className={`num w-12 shrink-0 text-sm font-semibold ${corFaixa(f)}`}>{fmtPct(a.pctRecente)}</span>
        {barra}
      </div>
      <span className="num hidden text-right text-sm text-muted md:block">{fmtPct(a.pctGeral)}</span>
      <span className="hidden text-right md:block">
        <Seta v={a.tendencia} />
      </span>
      <span className="hidden text-right md:block">
        <Ganho a={a} />
      </span>
      <div className="col-span-3 flex justify-between text-xs text-muted md:hidden">
        <span>Geral: {fmtPct(a.pctGeral)}</span>
        <Seta v={a.tendencia} />
      </div>
    </div>
  );
}

function Ganho({ a }: { a: DiagArea }) {
  if (a.ganho <= 0) return <span className="text-sm font-medium text-pos">na meta ✓</span>;
  return (
    <span className="num whitespace-nowrap text-sm font-semibold">
      +{fmtNum1(a.ganho)} <span className="font-normal text-muted">de {Math.round(a.questoes)}</span>
    </span>
  );
}

/* ---------------- plano em frases ---------------- */

function Plano({ d, meta }: { d: Diagnostico; meta: number }) {
  const abaixo = d.areas.filter((a) => a.ganho > 0);
  const top = abaixo.slice(0, 2);
  const somaTop = top.reduce((s, a) => s + a.ganho, 0);
  const somaTudo = abaixo.reduce((s, a) => s + a.ganho, 0);
  const caindo = d.areas.filter((a) => a.tendencia !== null && a.tendencia <= -3).sort((x, y) => x.tendencia! - y.tendencia!);
  const naMeta = d.areas.filter((a) => a.ganho <= 0);
  const ultimaPend = d.pendentes[0];

  const itens: React.ReactNode[] = [];
  if (top.length) {
    itens.push(
      <>
        Comece por <b>{top.map((a) => a.area).join(" e ")}</b>: {top.length > 1 ? "juntas valem" : "vale"}{" "}
        <b>+{fmtNum1(somaTop)} questões por prova</b>
        {abaixo.length > top.length && <> das +{fmtNum1(somaTudo)} que as áreas abaixo da meta somam</>}.
      </>,
    );
  }
  if (caindo.length) {
    itens.push(
      <>
        Atenção: <b>{caindo.map((a) => a.area).join(", ")}</b> {caindo.length > 1 ? "caíram" : "caiu"} nas provas
        recentes ({caindo.map((a) => `${fmtSinal(a.tendencia!)} pts`).join(", ")}).
      </>,
    );
  }
  if (naMeta.length) {
    itens.push(
      <>
        <b>{naMeta.map((a) => a.area).join(", ")}</b> já {naMeta.length > 1 ? "estão" : "está"} na meta: só manter com
        revisão leve.
      </>,
    );
  } else if (d.areas.length) {
    const melhor = [...d.areas].sort((a, b) => b.pctRecente - a.pctRecente)[0]!;
    itens.push(
      <>
        Sua área mais forte hoje é <b>{melhor.area}</b> ({fmtPct(melhor.pctRecente)}): revisão leve para não perder.
      </>,
    );
  }
  if (ultimaPend) {
    itens.push(
      <>
        Estude os erros da <b>{ultimaPend.prova.banca} {ultimaPend.prova.ano}</b> ({ultimaPend.areas.length} área
        {ultimaPend.areas.length > 1 ? "s" : ""} pendente{ultimaPend.areas.length > 1 ? "s" : ""}) antes da próxima prova:
        é onde está o aprendizado mais fresco.
        {d.pendentes.length > 1 && <> Outras {d.pendentes.length - 1} prova(s) da {BANCA_FOCO} também têm erros pendentes.</>}
      </>,
    );
  }
  if (d.anosFaltando.length) {
    itens.push(
      <>
        Provas da {BANCA_FOCO} que ainda não estão no painel: <b>{d.anosFaltando.join(", ")}</b>. Boas para fazer como
        simulado.
      </>,
    );
  }
  if (!itens.length) return null;

  return (
    <Secao titulo="🧭 Seu plano até a prova" sub={`Gerado a partir das suas notas, com a meta de ${meta}%.`}>
      <Card>
        <ol className="space-y-2.5 text-sm leading-relaxed">
          {itens.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ background: ROXO }}
              >
                {i + 1}
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ol>
      </Card>
    </Secao>
  );
}

/* ---------------- contagem regressiva ---------------- */

function Contagem({ dataProva }: { dataProva: string | null }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(dataProva ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();
  const dias = diasAte(dataProva);

  const salvar = () =>
    start(async () => {
      const r = await salvarDataProva(valor);
      if (r.ok) {
        setErro(null);
        setEditando(false);
      } else setErro(r.erro);
    });

  if (editando) {
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Data da prova da {BANCA_FOCO}</span>
          <input type="date" value={valor} onChange={(e) => setValor(e.target.value)} className={classeCampo} />
        </label>
        <Botao onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Botao>
        <Botao tipo="secundario" onClick={() => setEditando(false)}>
          Cancelar
        </Botao>
        {erro && <p className="w-full text-xs text-neg">{erro}</p>}
      </div>
    );
  }

  if (dias === null) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="w-full rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-left text-sm text-muted hover:bg-card2"
      >
        📅 Quando é a sua prova da {BANCA_FOCO}? <span className="font-medium text-accent">Definir data</span> para ver a
        contagem regressiva.
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:px-5">
      <div className="flex items-baseline gap-3">
        <span className="num text-3xl font-bold tracking-tight text-accent">{dias > 0 ? dias : 0}</span>
        <span className="text-sm">
          {dias > 1 ? "dias" : "dia"} para a prova da <b>{BANCA_FOCO}</b>{" "}
          <span className="text-muted">({dataBR(dataProva)})</span>
          {dias === 0 && <b> · é hoje, boa prova!</b>}
          {dias < 0 && <span className="text-muted"> · data já passou</span>}
        </span>
      </div>
      <button onClick={() => setEditando(true)} className="text-xs text-muted underline-offset-2 hover:underline">
        alterar data
      </button>
    </div>
  );
}
