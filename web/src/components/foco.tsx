"use client";

import { useState, useTransition, type ReactNode } from "react";
import { AMARELO, Botao, Card, Chip, Info, MARINHO, Metrica, Secao, VERDE, classeCampo, corFaixa } from "./comum";
import { GraficoEvolucao, GraficoMini } from "./graficos";
import { EstudoErros } from "./dashboard";
import { salvarDataProva, salvarPlanoFoco } from "@/server/acoes";
import {
  AREAS,
  BANCA_FOCO,
  N_RECENTES,
  QUESTOES_PADRAO,
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
  validarPlano,
  type Area,
  type DiagArea,
  type Diagnostico,
  type PlanoFoco,
  type Prova,
} from "@/lib/calc";

/** Cor da barra: azul enquanto sobe, amarelo quando está quase, verde quando chegou. */
const COR_FAIXA = { bom: VERDE, perto: AMARELO, ruim: MARINHO } as const;

/** Painel do modo foco: tudo só com as provas da banca-alvo (USP-SP). */
export default function DiagnosticoFoco({
  provas,
  areas,
  plano,
  planoSalvo,
  dataProva,
  planoAberto,
  setPlanoAberto,
}: {
  provas: Prova[];
  areas: Area[];
  plano: PlanoFoco;
  planoSalvo: boolean;
  dataProva: string | null;
  planoAberto: boolean;
  setPlanoAberto: (v: boolean) => void;
}) {
  const d = diagnostico(provas, areas, plano);
  const foco = filtrarBanca(provas, areas, BANCA_FOCO);

  if (!d) {
    return <Info>Você ainda não cadastrou nenhuma prova da {BANCA_FOCO}. Adicione na aba Provas.</Info>;
  }

  const metaGeral = Math.round(d.metaPct);
  const series = evolucaoPorBanca(foco.provas, foco.areas);

  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <Contagem dataProva={dataProva} />
        <button
          onClick={() => setPlanoAberto(!planoAberto)}
          className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-card2"
          aria-expanded={planoAberto}
        >
          <span className="font-medium">⚙️ Metas por área</span>
          <span className="block text-xs text-muted">
            Prova de {d.totalQuestoes} questões · meta ≈ {fmtNum1(Math.round(d.metaQuestoes))}
          </span>
        </button>
      </div>

      {planoAberto && <AjustarPlano plano={plano} d={d} fechar={() => setPlanoAberto(false)} />}
      {!planoAberto && !planoSalvo && (
        <button
          onClick={() => setPlanoAberto(true)}
          className="mt-3 w-full rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-4 py-3 text-left text-sm hover:bg-accent/10"
        >
          🎯 <b>Monte a sua estratégia:</b> defina uma meta para cada área (mais alta onde você vai dar gás, mais baixa
          onde vai só manter). Hoje todas estão em {metaGeral}%.
        </button>
      )}

      <Cartoes d={d} abrirPlano={() => setPlanoAberto(true)} />

      <Prioridades d={d} />
      <Plano d={d} />

      <Secao titulo={`Evolução na ${BANCA_FOCO}`} sub={`Cada ponto é uma prova, na data em que você fez. Linha tracejada = sua meta (${metaGeral}%).`}>
        <Card>
          <GraficoEvolucao series={series} meta={metaGeral} />
        </Card>
      </Secao>

      <Secao titulo={`Cada área na ${BANCA_FOCO}`} sub="Número grande = fase atual. Linha tracejada = a sua meta para a área.">
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
            const f = faixa(da.pctRecente, da.meta);
            return (
              <div key={ar} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{ar}</span>
                  <Seta v={da.tendencia} />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`num text-2xl font-semibold ${corFaixa(f)}`}>{fmtPct(da.pctRecente)}</span>
                  <span className="num text-xs text-muted">meta {da.meta}%</span>
                </div>
                <GraficoMini pontos={pts} meta={da.meta} cor={COR_FAIXA[f]} />
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
  const cls = v >= 1 ? "text-pos" : "text-muted";
  return (
    <span className={`num whitespace-nowrap text-xs font-medium ${cls}`} title="Fase atual comparada com as provas anteriores">
      {v >= 1 ? "▲" : v <= -1 ? "▼" : "="} {fmtSinal(v)} pts
    </span>
  );
}

/** "≈ 7" sem casas, sempre para cima quando é o que falta (não engana). */
const q = (v: number) => fmtNum1(Math.ceil(v - 0.05));

/* ---------------- os 4 números do topo ---------------- */

function Cartoes({ d, abrirPlano }: { d: Diagnostico; abrirPlano: () => void }) {
  const T = d.totalQuestoes;
  const meta = d.metaQuestoes;

  // 1. Última prova: quanto faltou (ou sobrou) na escala da prova-alvo
  let ultimaDetalhe: ReactNode = undefined;
  let ultimaCor = "text-muted";
  if (d.ultima && d.ultimaQuestoes !== null) {
    const falta = meta - d.ultimaQuestoes;
    if (falta <= 0) {
      ultimaDetalhe = `🎉 bateu a sua meta (≈ ${Math.round(d.ultimaQuestoes)} de ${T})`;
      ultimaCor = "text-pos";
    } else {
      ultimaDetalhe = `faltaram só ${q(falta)} questões para a meta, numa prova de ${T}`;
    }
  }

  // 2. Evolução: sempre a comparação mais justa e, se houver, a positiva
  let evoValor: ReactNode = "—";
  let evoRotulo = "Sua evolução";
  let evoDetalhe: ReactNode = "faça mais provas para comparar";
  let evoCor = "text-muted";
  if (d.ultima && d.primeira && d.ultima.id !== d.primeira.id && d.ultima.pct > d.primeira.pct) {
    evoValor = `+${fmtNum1(d.ultima.pct - d.primeira.pct)} pts`;
    evoDetalhe = `da 1ª ${BANCA_FOCO} (${fmtPct(d.primeira.pct)}) para a última (${fmtPct(d.ultima.pct)})`;
    evoCor = "text-pos";
  } else if (d.melhor) {
    evoRotulo = "Seu recorde";
    evoValor = fmtPct(d.melhor.pct);
    evoDetalhe = `${d.melhor.banca} ${d.melhor.ano}: você já fez isso uma vez`;
  }

  // 3. Hoje, na prova-alvo
  let hojeDetalhe: ReactNode = undefined;
  let hojeCor = "text-muted";
  if (d.atualQuestoes !== null) {
    const falta = meta - d.atualQuestoes;
    if (falta <= 0) {
      hojeDetalhe = "✓ no ritmo da sua meta";
      hojeCor = "text-pos";
    } else {
      hojeDetalhe = `a ${q(falta)} questões da meta: cerca de ${fmtNum1(Math.ceil((falta / AREAS.length) * 2) / 2)} por área`;
    }
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          rotulo="Última prova"
          valor={d.ultima ? fmtPct(d.ultima.pct) : "—"}
          detalhe={
            d.ultima ? (
              <>
                <span className="block text-muted">
                  {d.ultima.banca} {d.ultima.ano} · {mesAno(d.ultima.data_feita)}
                </span>
                {ultimaDetalhe}
              </>
            ) : undefined
          }
          corDetalhe={ultimaCor}
        />
        <Metrica rotulo={evoRotulo} valor={evoValor} detalhe={evoDetalhe} corDetalhe={evoCor} />
        <Metrica
          rotulo={`Hoje, na prova de ${T}`}
          valor={d.atualQuestoes === null ? "—" : `≈ ${Math.round(d.atualQuestoes)} acertos`}
          detalhe={hojeDetalhe}
          corDetalhe={hojeCor}
        />
        <div className="rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Sua meta</div>
          <div className="num mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {Math.round(meta)} <span className="text-base font-normal text-muted">de {T}</span>
          </div>
          <button onClick={abrirPlano} className="mt-1 text-sm text-accent underline-offset-2 hover:underline">
            ajustar metas por área
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Só provas da {BANCA_FOCO}, convertidas para a prova deste ano ({T} questões). &quot;Hoje&quot; usa a sua fase
        atual: as {N_RECENTES} provas mais recentes.
      </p>
    </>
  );
}

/* ---------------- ranking: onde ganhar pontos ---------------- */

function Prioridades({ d }: { d: Diagnostico }) {
  const foco = d.areas.filter((a) => a.ganho > 0).slice(0, 2).map((a) => a.area);
  return (
    <Secao
      titulo="🎯 Onde você ganha mais pontos"
      sub={`Da área que mais rende para a que menos rende, com as suas metas. "A ganhar" = quantas questões a mais você precisa nessa área para bater a meta dela, na prova de ${d.totalQuestoes}.`}
    >
      <Card className="!p-0">
        <div className="hidden grid-cols-[1.6rem_8.5rem_1fr_5.5rem_5.5rem_7.5rem] items-center gap-3 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted md:grid">
          <span>#</span>
          <span>Área</span>
          <span>Fase atual × sua meta</span>
          <span className="text-right">Meta</span>
          <span className="text-right">Tendência</span>
          <span className="text-right">A ganhar</span>
        </div>
        {d.areas.map((a, i) => (
          <LinhaPrioridade key={a.area} a={a} i={i} destaque={foco.includes(a.area)} />
        ))}
      </Card>
    </Secao>
  );
}

function LinhaPrioridade({ a, i, destaque }: { a: DiagArea; i: number; destaque: boolean }) {
  const f = faixa(a.pctRecente, a.meta);
  const barra = (
    <div className="relative h-2.5 w-full rounded-full bg-card2">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, a.pctRecente)}%`, background: COR_FAIXA[f] }}
      />
      <div className="absolute -inset-y-1 w-0.5 rounded bg-gold" style={{ left: `${a.meta}%` }} title={`Meta ${a.meta}%`} />
    </div>
  );
  return (
    <div
      className={`grid grid-cols-[1.6rem_1fr_auto] items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 last:border-0 md:grid-cols-[1.6rem_8.5rem_1fr_5.5rem_5.5rem_7.5rem] md:px-5 ${
        destaque ? "bg-accent/[0.05]" : ""
      }`}
    >
      <span className="num text-sm font-semibold text-muted">{i + 1}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{a.area}</div>
        {destaque && (
          <div className="mt-0.5">
            <Chip texto="Foco" cor={MARINHO} />
          </div>
        )}
      </div>
      <span className="text-right md:hidden">
        <Ganho a={a} />
      </span>
      <div className="col-span-3 flex items-center gap-3 md:col-span-1">
        <span className={`num w-12 shrink-0 text-sm font-semibold ${corFaixa(f)}`}>{fmtPct(a.pctRecente)}</span>
        {barra}
      </div>
      <span className="num hidden text-right text-sm text-muted md:block">{a.meta}%</span>
      <span className="hidden text-right md:block">
        <Seta v={a.tendencia} />
      </span>
      <span className="hidden text-right md:block">
        <Ganho a={a} />
      </span>
      <div className="col-span-3 flex justify-between text-xs text-muted md:hidden">
        <span>Meta: {a.meta}%</span>
        <Seta v={a.tendencia} />
      </div>
    </div>
  );
}

function Ganho({ a }: { a: DiagArea }) {
  if (a.ganho <= 0) return <span className="whitespace-nowrap text-sm font-medium text-pos">✓ na meta</span>;
  return (
    <span className="num whitespace-nowrap text-sm font-semibold">
      +{fmtNum1(a.ganho)} <span className="font-normal text-muted">de {a.questoes}</span>
    </span>
  );
}

/* ---------------- plano em frases ---------------- */

function Plano({ d }: { d: Diagnostico }) {
  const abaixo = d.areas.filter((a) => a.ganho > 0);
  const top = abaixo.slice(0, 2);
  const somaTop = top.reduce((s, a) => s + a.ganho, 0);
  const subindo = d.areas.filter((a) => a.tendencia !== null && a.tendencia >= 3).sort((x, y) => y.tendencia! - x.tendencia!);
  const oscilando = d.areas.filter((a) => a.tendencia !== null && a.tendencia <= -5 && a.ganho > 0);
  const naMeta = d.areas.filter((a) => a.ganho <= 0);
  const ultimaPend = d.pendentes[0];
  const e = (xs: DiagArea[]) => xs.map((a) => a.area).join(" e ").replace(/ e (?=.* e )/g, ", ");

  const itens: ReactNode[] = [];
  if (top.length) {
    itens.push(
      <>
        Seu foco agora: <b>{e(top)}</b>. Chegar na sua meta {top.length > 1 ? "nelas" : "nela"} vale{" "}
        <b>+{fmtNum1(somaTop)} questões</b> na prova.
      </>,
    );
  }
  if (subindo.length) {
    itens.push(
      <>
        Você está subindo em <b>{e(subindo)}</b> ({subindo.map((a) => `${fmtSinal(a.tendencia!)} pts`).join(", ")} nas
        provas recentes). O estudo está funcionando: continue.
      </>,
    );
  }
  if (naMeta.length) {
    itens.push(
      <>
        <b>{e(naMeta)}</b> já {naMeta.length > 1 ? "estão" : "está"} na sua meta: só manter com revisão leve.
      </>,
    );
  }
  if (oscilando.length) {
    itens.push(
      <>
        Vale uma revisão em <b>{e(oscilando)}</b>: {oscilando.length > 1 ? "oscilaram" : "oscilou"} para baixo nas últimas
        provas.
      </>,
    );
  }
  if (ultimaPend) {
    itens.push(
      <>
        Estude os erros da <b>{ultimaPend.prova.banca} {ultimaPend.prova.ano}</b> antes da próxima prova: é onde está o
        aprendizado mais fresco.
        {d.pendentes.length > 1 && <> Outras {d.pendentes.length - 1} prova(s) da {BANCA_FOCO} também têm erros para estudar.</>}
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
    <Secao titulo="🧭 Seu plano até a prova" sub="Gerado a partir das suas notas e das suas metas por área.">
      <Card>
        <ol className="space-y-2.5 text-sm leading-relaxed">
          {itens.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
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

/* ---------------- metas e questões por área ---------------- */

function AjustarPlano({ plano, d, fechar }: { plano: PlanoFoco; d: Diagnostico; fechar: () => void }) {
  const [metas, setMetas] = useState<Record<string, number>>({ ...plano.metas });
  const [questoes, setQuestoes] = useState<Record<string, number>>({ ...plano.questoes });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();

  const total = AREAS.reduce((s, a) => s + (questoes[a] || 0), 0);
  const metaQ = AREAS.reduce((s, a) => s + ((metas[a] || 0) / 100) * (questoes[a] || 0), 0);
  const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));
  const mudaMeta = (a: string, v: number) => setMetas({ ...metas, [a]: limitar(v, 30, 100) });

  const salvar = () => {
    const p = { metas, questoes };
    const e = validarPlano(p);
    if (e) return setErro(e);
    start(async () => {
      const r = await salvarPlanoFoco(p);
      if (r.ok) {
        setErro(null);
        fechar();
      } else setErro(r.erro);
    });
  };

  return (
    <div className="mt-3 rounded-2xl border border-accent/40 bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">⚙️ Metas por área</h3>
        <span className="num text-sm text-muted">
          Prova de <b className="text-text">{total}</b> questões · sua meta ≈{" "}
          <b className="text-text">{Math.round(metaQ)}</b> ({total ? fmtPct((metaQ / total) * 100) : "—"})
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Meta mais alta onde você vai dar gás, mais baixa onde vai só manter. As questões por área seguem a divisão das
        provas antigas (de 120 para 100); ajuste quando sair o edital.
      </p>

      <div className="mt-4 space-y-2">
        <div className="hidden grid-cols-[9rem_1fr_7rem] gap-3 px-1 text-xs font-medium text-muted sm:grid">
          <span>Área</span>
          <span>Meta (%)</span>
          <span>Questões na prova</span>
        </div>
        {AREAS.map((a) => {
          const atual = d.areas.find((x) => x.area === a)?.pctRecente;
          return (
            <div
              key={a}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl bg-card2 p-2.5 sm:grid-cols-[9rem_1fr_7rem] sm:bg-transparent sm:p-1"
            >
              <div>
                <div className="text-sm font-medium">{a}</div>
                {atual !== undefined && <div className="num text-xs text-muted">hoje: {fmtPct(atual)}</div>}
              </div>
              <div className="col-span-2 row-start-2 flex items-center gap-2 sm:col-span-1 sm:row-start-auto">
                <button
                  onClick={() => mudaMeta(a, (metas[a] || 0) - 5)}
                  className="h-9 w-9 shrink-0 rounded-lg border border-border bg-card text-lg leading-none hover:bg-card2"
                  aria-label={`Diminuir meta de ${a}`}
                >
                  −
                </button>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={1}
                  value={metas[a] || 0}
                  onChange={(ev) => mudaMeta(a, Number(ev.target.value))}
                  className="w-full accent-[#3a6aa5]"
                  aria-label={`Meta de ${a}`}
                />
                <button
                  onClick={() => mudaMeta(a, (metas[a] || 0) + 5)}
                  className="h-9 w-9 shrink-0 rounded-lg border border-border bg-card text-lg leading-none hover:bg-card2"
                  aria-label={`Aumentar meta de ${a}`}
                >
                  +
                </button>
                <span className="num w-12 shrink-0 text-right text-sm font-semibold">{metas[a]}%</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted sm:block">
                <span className="sm:hidden">questões</span>
                <input
                  inputMode="numeric"
                  value={String(questoes[a] ?? "")}
                  onChange={(ev) => {
                    const v = ev.target.value.replace(/\D/g, "").slice(0, 2);
                    setQuestoes({ ...questoes, [a]: v === "" ? 0 : Number(v) });
                  }}
                  className={`${classeCampo} num w-16 sm:w-full`}
                  aria-label={`Questões de ${a} na prova`}
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Botao onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar metas"}
        </Botao>
        <Botao tipo="secundario" onClick={fechar}>
          Cancelar
        </Botao>
        <button
          onClick={() => setQuestoes({ ...QUESTOES_PADRAO })}
          className="ml-auto text-xs text-muted underline-offset-2 hover:underline"
        >
          voltar questões para 20/20/20/10/10/20
        </button>
      </div>
      {erro && <p className="mt-2 text-sm text-neg">{erro}</p>}
    </div>
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
          {dias === 1 ? "dia" : "dias"} para a prova da <b>{BANCA_FOCO}</b>{" "}
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
