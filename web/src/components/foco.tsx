"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { AMARELO, Botao, Card, Chip, Info, MARINHO, Metrica, Secao, VERDE, classeCampo, corFaixa } from "./comum";
import { GraficoRadar, GraficoTempo } from "./graficos";
import { EstudoErros } from "./dashboard";
import { salvarDataProva, salvarPlanoFoco } from "@/server/acoes";
import {
  AREAS,
  BANCA_FOCO,
  MOTIVOS,
  MOTIVO_TEXTO,
  N_RECENTES,
  PERFIL_LABEL,
  QUESTOES_PADRAO,
  chaveTema,
  consistencia,
  dataBR,
  diagnostico,
  diasAte,
  idsJanela,
  faixa,
  filtrarBanca,
  fmtNum1,
  fmtPct,
  fmtSinal,
  focoDaSemana,
  mapaCalor,
  mesAno,
  pareto,
  serieTempo,
  validarPlano,
  type Area,
  type Consistencia,
  type DiagArea,
  type Diagnostico,
  type ErroReg,
  type Janela,
  type Perfil,
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
  erros,
  irParaErros,
}: {
  provas: Prova[];
  areas: Area[];
  plano: PlanoFoco;
  planoSalvo: boolean;
  dataProva: string | null;
  planoAberto: boolean;
  setPlanoAberto: (v: boolean) => void;
  erros: ErroReg[];
  irParaErros: () => void;
}) {
  const [modoTempo, setModoTempo] = useState<"ordem" | "ano">("ordem");
  const [janela, setJanelaSt] = useState<Janela>(N_RECENTES);
  // lembra o período escolhido neste aparelho
  useEffect(() => {
    try {
      const v = localStorage.getItem("janelaFoco");
      if (v === "todas") setJanelaSt(null);
      else if (v && Number(v) >= 1) setJanelaSt(Number(v));
    } catch {
      /* sem armazenamento */
    }
  }, []);
  const setJanela = (j: Janela) => {
    setJanelaSt(j);
    try {
      localStorage.setItem("janelaFoco", j === null ? "todas" : String(j));
    } catch {
      /* sem armazenamento */
    }
  };
  const d = diagnostico(provas, areas, plano, BANCA_FOCO, janela);
  const foco = filtrarBanca(provas, areas, BANCA_FOCO);

  if (!d) {
    return <Info>Você ainda não cadastrou nenhuma prova da {BANCA_FOCO}. Adicione na aba Provas.</Info>;
  }

  const metaGeral = Math.round(d.metaPct);
  const cons = consistencia(provas, areas, BANCA_FOCO, janela);
  const tempo = serieTempo(provas, areas, BANCA_FOCO, 3, janela);
  const idsFoco = new Set(foco.provas.map((p) => p.id));
  const errosFoco = erros.filter((e) => e.prova_id === null || idsFoco.has(e.prova_id));

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

      <Periodo provas={provas} areas={areas} janela={janela} setJanela={setJanela} total={d.nCompletas} />

      <Kpis d={d} cons={cons} />
      <Conquistas d={d} />

      <FocoSemana d={d} erros={errosFoco} irParaErros={irParaErros} />

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Secao titulo="🕸️ Equilíbrio entre as áreas" sub={`Azul = sua nota no período escolhido (${rotuloJanela(d.janelaN, d.nCompletas)}). Tracejado dourado = suas metas.`}>
          <Card>
            <GraficoRadar dados={d.areas.map((a) => ({ area: a.area, atual: a.pctRecente, meta: a.meta })).sort((a, b) => AREAS.indexOf(a.area as never) - AREAS.indexOf(b.area as never))} />
          </Card>
        </Secao>
        <Secao titulo="📏 Consistência" sub={`No período escolhido (${rotuloJanela(d.janelaN, d.nCompletas)}). Barra = da sua pior à sua melhor nota na área. Ponto = média. Traço dourado = meta.`}>
          <Card>
            <Consistencias cons={cons} metas={plano.metas} poucas={d.janelaN < 3} />
          </Card>
        </Secao>
      </div>

      <Prioridades d={d} />

      <Secao
        titulo={`📈 Evolução na ${BANCA_FOCO}`}
        sub={
          modoTempo === "ordem"
            ? "Na ordem em que você fez. A linha grossa é a média móvel das últimas 3 provas: suaviza um dia ruim ou uma prova mais difícil. Faixa verde = acima da sua meta."
            : "Pelo ano da prova: mostra se as provas de certos anos foram mais difíceis para você. Nas suas notas, as de 2021 em diante têm cerca de 120 questões; as anteriores, cerca de 100."
        }
        acao={
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
            {(
              [
                ["ordem", "Ordem em que fiz"],
                ["ano", "Ano da prova"],
              ] as const
            ).map(([id, t]) => (
              <button
                key={id}
                onClick={() => setModoTempo(id)}
                className={`rounded-md px-2.5 py-1 font-medium ${modoTempo === id ? "bg-accent text-white" : "text-muted hover:text-text"}`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      >
        <Card>
          {tempo.length ? <GraficoTempo pontos={tempo} meta={metaGeral} modo={modoTempo} /> : <p className="text-sm text-muted">Sem provas completas ainda.</p>}
          {janela !== null && tempo.length > d.janelaN && (
            <p className="mt-2 text-xs text-muted">O gráfico mostra todo o histórico; a faixa azul clara marca o período que você escolheu analisar.</p>
          )}
        </Card>
      </Secao>

      <MapaCalor provas={provas} areas={areas} metas={plano.metas} janela={janela} />

      <EstudoErros areas={foco.areas} />
    </div>
  );
}

/** "últimas 3" / "todas as 6" */
function rotuloJanela(n: number, total: number): string {
  if (n >= total) return total === 1 ? "sua única prova" : `todas as ${total} provas`;
  return n === 1 ? "última prova" : `últimas ${n} provas`;
}

/** Escolha do período: só as provas mais recentes, que representam melhor como você está hoje. */
function Periodo({
  provas,
  areas,
  janela,
  setJanela,
  total,
}: {
  provas: Prova[];
  areas: Area[];
  janela: Janela;
  setJanela: (j: Janela) => void;
  total: number;
}) {
  if (total < 2) return null;
  const opcoes: { valor: Janela; texto: string }[] = [2, 3, 4, 5]
    .filter((n) => n < total)
    .map((n) => ({ valor: n, texto: `Últimas ${n}` }));
  opcoes.push({ valor: null, texto: `Todas (${total})` });
  const atual = janela !== null && janela >= total ? null : janela;
  const ids = idsJanela(provas, areas, atual);
  const usadas = provas
    .filter((p) => ids.has(p.id))
    .sort((a, b) => (a.data_feita ?? "").localeCompare(b.data_feita ?? ""));
  const de = usadas[0];
  const ate = usadas[usadas.length - 1];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm font-medium">Analisar:</span>
      <div className="inline-flex flex-wrap rounded-xl border border-border bg-card p-1" role="radiogroup" aria-label="Período analisado">
        {opcoes.map((o) => (
          <button
            key={String(o.valor)}
            role="radio"
            aria-checked={atual === o.valor}
            onClick={() => setJanela(o.valor)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              atual === o.valor ? "bg-accent text-white shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {de && ate && (
        <span className="text-xs text-muted">
          {usadas.map((p) => p.ano).join(", ")} · feitas de {mesAno(de.data_feita)} a {mesAno(ate.data_feita)}
        </span>
      )}
    </div>
  );
}

function Seta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-xs text-faint">—</span>;
  const cls = v >= 1 ? "text-pos" : "text-muted";
  return (
    <span className={`num whitespace-nowrap text-xs font-medium ${cls}`} title="Período escolhido comparado com as provas de antes dele">
      {v >= 1 ? "▲" : v <= -1 ? "▼" : "="} {fmtSinal(v)} pts
    </span>
  );
}

/** Arredonda para cima o que falta (não engana para menos). */
const q = (v: number) => fmtNum1(Math.ceil(v - 0.05));

/* ---------------- KPIs do topo ---------------- */

function Kpis({ d, cons }: { d: Diagnostico; cons: Consistencia[] }) {
  const T = d.totalQuestoes;
  const meta = d.metaQuestoes;
  const atual = d.atualQuestoes;
  const caminho = atual === null || meta <= 0 ? null : Math.min(100, Math.round((atual / meta) * 100));
  const forte = [...d.areas].sort((a, b) => b.pctRecente - a.pctRecente)[0];
  const forteCons = forte ? cons.find((c) => c.area === forte.area) : undefined;
  const prioridade = d.areas.find((a) => a.ganho > 0);

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          rotulo={`Média · ${rotuloJanela(d.janelaN, d.nCompletas)}`}
          valor={d.pctRecente === null ? "—" : fmtPct(d.pctRecente)}
          detalhe={
            <>
              {atual !== null && <span className="block">≈ {Math.round(atual)} de {T} acertos</span>}
              {d.tendencia !== null && d.tendencia >= 1 ? (
                <span className="text-pos">▲ {fmtSinal(d.tendencia)} pts vs provas anteriores</span>
              ) : (
                <span>
                  {d.janelaN >= d.nCompletas
                    ? "todas as suas provas"
                    : d.janelaN === 1
                      ? "só a última prova"
                      : `${d.janelaN} provas mais recentes`}
                </span>
              )}
            </>
          }
        />
        <div className="rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Rumo à meta</div>
          <div className="num mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {caminho === null ? "—" : caminho >= 100 ? "Meta ✓" : `${caminho}%`}
            {caminho !== null && caminho < 100 && <span className="ml-1 text-sm font-normal text-muted">do caminho</span>}
          </div>
          {caminho !== null && (
            <>
              <div className="mt-2 h-2 rounded-full bg-card2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${caminho}%` }} />
              </div>
              <div className="num mt-1.5 text-sm text-muted">
                {atual !== null && meta - atual > 0
                  ? `≈ ${Math.round(atual!)} de ${Math.round(meta)} · faltam ≈ ${q(meta - atual!)}`
                  : `você está no ritmo da meta (${Math.round(meta)} de ${T})`}
              </div>
            </>
          )}
        </div>
        <Metrica
          rotulo="Área mais forte"
          valor={forte ? forte.area : "—"}
          detalhe={
            forte ? (
              <>
                <span className="num block">{fmtPct(forte.pctRecente)} no período</span>
                {forteCons?.perfil === "pilar" && <span className="text-pos">pilar seguro: oscila pouco</span>}
              </>
            ) : undefined
          }
        />
        <Metrica
          rotulo="Foco prioritário"
          valor={prioridade ? prioridade.area : "Todas na meta ✓"}
          detalhe={
            prioridade ? (
              <span className="num">
                +{fmtNum1(prioridade.ganho)} questões possíveis (de {prioridade.questoes}) até a sua meta de {prioridade.meta}%
              </span>
            ) : (
              "mantenha o ritmo"
            )
          }
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Só provas da {BANCA_FOCO}, no período escolhido acima, convertidas para a prova deste ano ({T} questões).
      </p>
    </>
  );
}

/** Faixa de conquistas: o que já deu certo (motivação com dado real). */
function Conquistas({ d }: { d: Diagnostico }) {
  const itens: ReactNode[] = [];
  if (d.ultima) {
    const falta = d.ultimaQuestoes !== null ? d.metaQuestoes - d.ultimaQuestoes : null;
    itens.push(
      <>
        Última prova: <b>{fmtPct(d.ultima.pct)}</b> ({d.ultima.banca} {d.ultima.ano})
        {falta !== null && (falta <= 0 ? " · bateu a meta 🎉" : ` · faltaram só ${q(falta)} questões`)}
      </>,
    );
  }
  if (d.ultima && d.primeira && d.ultima.id !== d.primeira.id && d.ultima.pct > d.primeira.pct) {
    itens.push(
      <>
        <b className="text-pos">+{fmtNum1(d.ultima.pct - d.primeira.pct)} pts</b> desde a sua 1ª {BANCA_FOCO}
      </>,
    );
  }
  if (d.melhor) {
    itens.push(
      <>
        Recorde: <b>{fmtPct(d.melhor.pct)}</b> ({d.melhor.banca} {d.melhor.ano})
      </>,
    );
  }
  if (!itens.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {itens.map((it, i) => (
        <span key={i} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs">
          {it}
        </span>
      ))}
    </div>
  );
}

/* ---------------- foco da semana + próximos passos ---------------- */

function FocoSemana({ d, erros, irParaErros }: { d: Diagnostico; erros: ErroReg[]; irParaErros: () => void }) {
  const f = focoDaSemana(d);
  const passos = proximosPassos(d);
  const motivos = pareto(erros.map((e) => e.motivo), (k) => MOTIVO_TEXTO[k] ?? k);
  const temas = pareto(erros.map((e) => chaveTema(e.tema)));
  const nomeTema = new Map(erros.map((e) => [chaveTema(e.tema), e.tema.trim()]));
  const topMotivo = motivos[0];
  const dica = topMotivo ? MOTIVOS.find((m) => m.id === topMotivo.chave)?.dica : undefined;

  return (
    <Secao titulo="🎯 Foco da semana" sub="Gerado automaticamente a partir das suas últimas provas e das suas metas.">
      <Card className="border-accent/40">
        {f && (
          <div>
            <div className="text-base font-semibold">
              Esta semana: <span className="text-accent">{f.area}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed">
              É a área que mais te afasta da sua meta. {d.janelaN === d.nCompletas ? "No total das suas provas" : `Nas últimas ${d.janelaN} provas`} ficou em{" "}
              <b>{fmtPct(f.pctArea)}</b>, ou ≈ {Math.round(f.acertosHoje)} de {f.questoes} na prova de {d.totalQuestoes}
              {f.abaixo > 0 && <>, {fmtNum1(f.abaixo)} pts abaixo da sua média geral</>}.
            </p>
            <div className="mt-3 rounded-xl bg-card2 px-4 py-3 text-sm leading-relaxed">
              Para a sua nota geral <b>subir 5 pontos</b>
              {d.atualQuestoes !== null && (
                <>
                  {" "}
                  (≈ {Math.round(d.atualQuestoes)} → {Math.round(d.atualQuestoes) + f.extras} de {d.totalQuestoes})
                </>
              )}
              , você precisa de <b>+{f.extras} acertos</b>.
              {f.cabe ? (
                <>
                  {" "}
                  Dá para tirar todos de {f.area}: de ≈ {Math.round(f.acertosHoje)} para{" "}
                  {Math.min(f.questoes, Math.round(f.acertosHoje) + f.extras)} de {f.questoes}.
                </>
              ) : (
                <> Em {f.area} sozinha não cabe tudo: divida entre as áreas abaixo.</>
              )}
              {f.divisao.length > 1 && (
                <>
                  {" "}
                  Ou divida pelo que cada área rende: {f.divisao.map((x) => `+${x.extras} em ${x.area}`).join(", ")}.
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Próximos passos</div>
          <ol className="space-y-2.5 text-sm leading-relaxed">
            {passos.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span>{it}</span>
              </li>
            ))}
            <li className="flex gap-3">
              <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                {passos.length + 1}
              </span>
              <span>
                {topMotivo ? (
                  <>
                    Pelo seu caderno de erros, o que mais te derruba é <b>{topMotivo.texto}</b> ({fmtPct(topMotivo.pct)})
                    {temas[0] && (
                      <>
                        , e o tema mais errado é <b>{nomeTema.get(temas[0].chave) ?? temas[0].chave}</b>
                      </>
                    )}
                    .{dica && <> Dica: {dica}.</>}{" "}
                  </>
                ) : (
                  <>Registre os erros de cada prova no caderno: o painel passa a mostrar por que você erra e quais temas mais caem para você. </>
                )}
                <button onClick={irParaErros} className="font-medium text-accent underline-offset-2 hover:underline">
                  Abrir caderno de erros →
                </button>
              </span>
            </li>
          </ol>
        </div>
      </Card>
    </Secao>
  );
}

function proximosPassos(d: Diagnostico): ReactNode[] {
  const subindo = d.areas.filter((a) => a.tendencia !== null && a.tendencia >= 3).sort((x, y) => y.tendencia! - x.tendencia!);
  const oscilando = d.areas.filter((a) => a.tendencia !== null && a.tendencia <= -5 && a.ganho > 0);
  const naMeta = d.areas.filter((a) => a.ganho <= 0);
  const ultimaPend = d.pendentes[0];
  const e = (xs: DiagArea[]) => xs.map((a) => a.area).join(" e ").replace(/ e (?=.* e )/g, ", ");
  const itens: ReactNode[] = [];
  if (subindo.length) {
    itens.push(
      <>
        Você está subindo em <b>{e(subindo)}</b> ({subindo.map((a) => `${fmtSinal(a.tendencia!)} pts`).join(", ")}). O estudo
        está funcionando: continue.
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
        Estude os erros da <b>{ultimaPend.prova.banca} {ultimaPend.prova.ano}</b>
        {ultimaPend.areas.length <= 3 && <> (falta {ultimaPend.areas.join(", ")})</>} antes da próxima prova: é onde está
        o aprendizado mais fresco.
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
  return itens;
}

/* ---------------- consistência (faixa de cada área) ---------------- */

const COR_PERFIL: Record<Perfil, string> = { pilar: VERDE, volatil: AMARELO, base: "#64748b", evolucao: MARINHO };

function Consistencias({ cons, metas, poucas }: { cons: Consistencia[]; metas: Record<string, number>; poucas: boolean }) {
  const pequenas = cons.filter((c) => c.pontosPorQuestao >= 8).map((c) => c.area);
  return (
    <div>
      <div className="space-y-3.5">
        {cons.map((c) => (
          <div key={c.area}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
              <span className="font-medium">
                {c.area} <Chip texto={PERFIL_LABEL[c.perfil]} cor={COR_PERFIL[c.perfil]} />
              </span>
              <span className="num text-xs text-muted">
                média {fmtPct(c.media)} · oscila ±{fmtNum1(Math.round(c.dp))} pts
              </span>
            </div>
            <div className="relative mt-1.5 h-3 rounded-full bg-card2">
              <div
                className="absolute inset-y-0 rounded-full"
                style={{ left: `${c.min}%`, width: `${Math.max(1, c.max - c.min)}%`, background: `${COR_PERFIL[c.perfil]}55` }}
                title={`de ${fmtPct(c.min)} a ${fmtPct(c.max)}`}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                style={{ left: `${c.media}%`, background: COR_PERFIL[c.perfil] }}
              />
              {metas[c.area] !== undefined && (
                <div className="absolute -inset-y-1 w-0.5 rounded bg-gold" style={{ left: `${metas[c.area]}%` }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        <b>Pilar seguro</b> = acima da sua média e estável. <b>Volátil</b> = muda muito de uma prova para outra.{" "}
        {pequenas.length > 0 && (
          <>
            Em {pequenas.join(" e ")}, 1 questão vale cerca de 10 pts: oscilar ali é esperado, então olhe mais para a
            média.{" "}
          </>
        )}
        {poucas && <>Com só 2 provas no período, a oscilação é apenas uma pista. </>}O painel não sabe quantas horas você
        estuda cada área; quem decide o esforço são as suas metas por área.
      </p>
    </div>
  );
}

/* ---------------- mapa de calor: prova × área ---------------- */

const CURTO: Record<string, string> = {
  "Clínica Médica": "Clínica",
  Cirurgia: "Cirurgia",
  Pediatria: "Pediatria",
  Ginecologia: "Gineco",
  Obstetrícia: "Obstet.",
  Preventiva: "Prevent.",
};

function MapaCalor({
  provas,
  areas,
  metas,
  janela,
}: {
  provas: Prova[];
  areas: Area[];
  metas: Record<string, number>;
  janela: Janela;
}) {
  const linhas = mapaCalor(provas, areas, BANCA_FOCO, janela);
  if (!linhas.length) return null;
  const fundo = (v: number | null) =>
    v === null ? "transparent" : `rgba(58,106,165,${(0.1 + (v / 100) * 0.8).toFixed(2)})`;
  const claro = (v: number | null) => v !== null && v >= 55;
  return (
    <Secao
      titulo="🗺️ Mapa de calor: prova × área"
      sub="Quanto mais escuro, maior a nota. ✓ = bateu a sua meta da área. De cima para baixo, na ordem em que você fez."
    >
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                Prova
              </th>
              {AREAS.map((a) => (
                <th key={a} className="border-b border-border px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {CURTO[a]}
                </th>
              ))}
              <th className="border-b border-border px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                Geral
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.prova.id} className={`border-b border-border last:border-0 ${l.dentro ? "" : "opacity-35"}`}>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="font-medium">{l.prova.ano}</div>
                  <div className="text-xs text-muted">
                    feita {mesAno(l.prova.data_feita)}
                    {!l.dentro && " · fora do período"}
                  </div>
                </td>
                {l.celulas.map((c) => (
                  <td key={c.area} className="p-1">
                    <div
                      className={`num rounded-md px-1 py-2 text-center text-xs font-semibold ${claro(c.pct) ? "text-white" : ""}`}
                      style={{ background: fundo(c.pct) }}
                      title={c.pct === null ? (c.status === "nao_fiz" ? "não fiz" : "sem nota") : `${c.acertos}/${c.total}`}
                    >
                      {c.pct === null ? <span className="text-faint">—</span> : `${Math.round(c.pct)}%`}
                      {c.pct !== null && metas[c.area] !== undefined && c.pct >= metas[c.area]! && " ✓"}
                    </div>
                  </td>
                ))}
                <td className="num px-3 py-2 text-right font-semibold">{l.geral === null ? "—" : fmtPct(l.geral)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Secao>
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
          <span>No período × sua meta</span>
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
