/**
 * Todas as contas do painel, sem tela nem banco: recebe as provas e as áreas e devolve os números.
 * As regras são as mesmas do app antigo (Streamlit), para os resultados baterem.
 */

export const AREAS = [
  "Clínica Médica",
  "Cirurgia",
  "Pediatria",
  "Ginecologia",
  "Obstetrícia",
  "Preventiva",
] as const;
export type NomeArea = (typeof AREAS)[number];

export const FIZ = "feita";
export const NAO_FIZ = "nao_fiz";
export type Status = typeof FIZ | typeof NAO_FIZ;
export const STATUS_LABEL: Record<Status, string> = { feita: "Fiz", nao_fiz: "Não fiz" };

export const BANCA_FOCO = "USP-SP";

export interface Prova {
  id: number;
  banca: string;
  ano: number;
  data_feita: string | null; // "AAAA-MM-DD"
  total_questoes: number;
  acertos: number;
}

export interface Area {
  id: number;
  prova_id: number;
  area: string;
  acertos: number;
  total: number;
  status: string;
  estudada: boolean;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** 65.333 → 65.3 */
export function arred1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Percentual com uma casa, ou null quando não há questões. */
export function pct(acertos: number, total: number): number | null {
  return total > 0 ? arred1((acertos / total) * 100) : null;
}

/** 65.3 → "65,3%" */
export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** +4.2 → "+4,2" */
export function fmtSinal(v: number): string {
  const s = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${v >= 0 ? "+" : "−"}${s}`;
}

/** "2026-04-12" → milissegundos (meia-noite UTC, sem escorregar de dia por fuso). */
export function dataMs(d: string | null): number {
  if (!d) return 0;
  const [a, m, dia] = d.split("-").map(Number);
  return Date.UTC(a ?? 1970, (m ?? 1) - 1, dia ?? 1);
}

/** "2026-04-12" → "Abril/26" */
export function mesAno(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(dataMs(d));
  return `${MESES[dt.getUTCMonth()]}/${String(dt.getUTCFullYear()).slice(2)}`;
}

/** milissegundos → "abr/26" (eixo dos gráficos) */
export function mesAnoCurto(ms: number): string {
  const dt = new Date(ms);
  return `${MESES_CURTOS[dt.getUTCMonth()]}/${String(dt.getUTCFullYear()).slice(2)}`;
}

/** "2026-04-12" → "12/04/2026" */
export function dataBR(d: string | null): string {
  if (!d) return "—";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

/** A área foi feita e tem nota (acertos/total preenchidos). */
export function temNota(a: Area): boolean {
  return a.status === FIZ && a.total > 0;
}

export function areasDaProva(areas: Area[], provaId: number): Area[] {
  return areas.filter((a) => a.prova_id === provaId);
}

/** Uma prova é "completa" quando TODAS as 6 áreas foram feitas e têm nota. */
export function idsCompletas(areas: Area[]): Set<number> {
  const porProva = new Map<number, Set<string>>();
  for (const a of areas) {
    if (!temNota(a)) continue;
    if (!porProva.has(a.prova_id)) porProva.set(a.prova_id, new Set());
    porProva.get(a.prova_id)!.add(a.area);
  }
  const ids = new Set<number>();
  for (const [id, feitas] of porProva) {
    if (AREAS.every((ar) => feitas.has(ar))) ids.add(id);
  }
  return ids;
}

export type ProvaComPct = Prova & { pct: number };

/** Provas completas com o % calculado. */
export function provasCompletas(provas: Prova[], areas: Area[]): ProvaComPct[] {
  const ids = idsCompletas(areas);
  return provas
    .filter((p) => ids.has(p.id) && p.total_questoes > 0)
    .map((p) => ({ ...p, pct: pct(p.acertos, p.total_questoes)! }));
}

export interface Kpis {
  completas: number;
  incompletas: number;
  media: number;
  gap: number;
  melhor: ProvaComPct;
  pior: ProvaComPct;
  mediaFoco: number | null;
}

/** Números do topo do Dashboard (só provas completas). */
export function kpis(provas: Prova[], areas: Area[], meta: number): Kpis | null {
  const comp = provasCompletas(provas, areas);
  if (comp.length === 0) return null;
  const media = comp.reduce((s, p) => s + p.pct, 0) / comp.length;
  // empate: fica com a primeira da lista (mesma regra do app antigo)
  let melhor = comp[0]!;
  let pior = comp[0]!;
  for (const p of comp) {
    if (p.pct > melhor.pct) melhor = p;
    if (p.pct < pior.pct) pior = p;
  }
  const foco = comp.filter((p) => p.banca === BANCA_FOCO);
  const mediaFoco = foco.length ? foco.reduce((s, p) => s + p.pct, 0) / foco.length : null;
  return {
    completas: comp.length,
    incompletas: provas.length - comp.length,
    media,
    gap: media - meta,
    melhor,
    pior,
    mediaFoco,
  };
}

export interface SerieBanca {
  banca: string;
  pontos: { t: number; pct: number; ano: number; acertos: number; total: number; banca: string }[];
}

/** Evolução das provas completas no tempo, uma linha por banca. */
export function evolucaoPorBanca(provas: Prova[], areas: Area[]): SerieBanca[] {
  const comp = provasCompletas(provas, areas)
    .filter((p) => p.data_feita)
    .sort((a, b) => dataMs(a.data_feita) - dataMs(b.data_feita));
  const series = new Map<string, SerieBanca>();
  for (const p of comp) {
    if (!series.has(p.banca)) series.set(p.banca, { banca: p.banca, pontos: [] });
    series.get(p.banca)!.pontos.push({
      t: dataMs(p.data_feita),
      pct: p.pct,
      ano: p.ano,
      acertos: p.acertos,
      total: p.total_questoes,
      banca: p.banca,
    });
  }
  return [...series.values()];
}

export interface AreaAgregada {
  area: string;
  acertos: number;
  total: number;
  pct: number;
}

/** Soma acertos/total por área (só áreas com nota), da pior para a melhor. */
export function agregarPorArea(areas: Area[]): AreaAgregada[] {
  const m = new Map<string, { acertos: number; total: number }>();
  for (const a of areas) {
    if (!temNota(a)) continue;
    const cur = m.get(a.area) ?? { acertos: 0, total: 0 };
    cur.acertos += a.acertos;
    cur.total += a.total;
    m.set(a.area, cur);
  }
  return [...m.entries()]
    .filter(([, v]) => v.total > 0)
    .map(([area, v]) => ({ area, ...v, pct: pct(v.acertos, v.total)! }))
    .sort((a, b) => a.pct - b.pct);
}

export interface BancaMedia {
  banca: string;
  media: number;
  provas: number;
}

/** Média do % das provas completas, por banca, da melhor para a pior. */
export function mediaPorBanca(provas: Prova[], areas: Area[]): BancaMedia[] {
  const m = new Map<string, number[]>();
  for (const p of provasCompletas(provas, areas)) {
    if (!m.has(p.banca)) m.set(p.banca, []);
    m.get(p.banca)!.push(p.pct);
  }
  return [...m.entries()]
    // sem arredondar aqui: o arredondamento fica só na hora de mostrar (bate com o card "Média USP-SP")
    .map(([banca, v]) => ({ banca, media: v.reduce((s, x) => s + x, 0) / v.length, provas: v.length }))
    .sort((a, b) => b.media - a.media);
}

export interface EstudoArea {
  area: string;
  feitas: number;
  estudadas: number;
  faltam: number;
}

/** Quantas áreas feitas já tiveram os erros estudados. */
export function estudoDosErros(areas: Area[]): { feitas: number; estudadas: number; porArea: EstudoArea[] } | null {
  const feitas = areas.filter((a) => a.status === FIZ);
  if (feitas.length === 0) return null;
  const porArea: EstudoArea[] = [];
  for (const ar of AREAS) {
    const doArea = feitas.filter((a) => a.area === ar);
    if (doArea.length === 0) continue;
    const est = doArea.filter((a) => a.estudada).length;
    porArea.push({ area: ar, feitas: doArea.length, estudadas: est, faltam: doArea.length - est });
  }
  return { feitas: feitas.length, estudadas: feitas.filter((a) => a.estudada).length, porArea };
}

export type Categoria = "concluida" | "revisar" | "parcial" | "sem";

export interface Resumo {
  categoria: Categoria;
  label: string;
  naoFiz: string[];
  nComNota: number;
  nFeitas: number;
  nEstudadas: number;
}

/** Situação de UMA prova a partir das suas áreas. */
export function resumoProva(ap: Area[]): Resumo {
  const n = AREAS.length;
  const feitas = ap.filter((a) => a.status === FIZ);
  const nComNota = feitas.filter((a) => a.total > 0).length;
  const nFeitas = feitas.length;
  const nEstudadas = feitas.filter((a) => a.estudada).length;
  const naoFiz = ap.filter((a) => a.status === NAO_FIZ).map((a) => a.area);
  let categoria: Categoria;
  let label: string;
  if (nComNota === 0) {
    categoria = "sem";
    label = "Sem notas";
  } else if (nComNota < n) {
    categoria = "parcial";
    label = `Parcial (${nComNota}/${n} áreas)`;
  } else if (nEstudadas >= nFeitas) {
    categoria = "concluida";
    label = "Concluída";
  } else {
    categoria = "revisar";
    label = `Falta estudar (${nEstudadas}/${nFeitas})`;
  }
  return { categoria, label, naoFiz, nComNota, nFeitas, nEstudadas };
}

/** % da prova como aparece na lista (com "(parcial)" quando não está completa). */
export function pctDaLista(p: Prova, r: Resumo): string {
  const v = pct(p.acertos, p.total_questoes);
  if (v === null) return "—";
  return fmtPct(v) + (r.categoria === "parcial" || r.categoria === "sem" ? " (parcial)" : "");
}

export interface PontoArea {
  t: number;
  pct: number;
  rotulo: string;
  acertos: number;
  total: number;
  data: string | null;
}

/** Notas de uma área ao longo do tempo. */
export function evolucaoDaArea(area: string, areas: Area[], provas: Prova[]): PontoArea[] {
  const porId = new Map(provas.map((p) => [p.id, p]));
  return areas
    .filter((a) => a.area === area && temNota(a) && porId.get(a.prova_id)?.data_feita)
    .map((a) => {
      const p = porId.get(a.prova_id)!;
      return {
        t: dataMs(p.data_feita),
        pct: pct(a.acertos, a.total)!,
        rotulo: `${p.banca} ${p.ano}`,
        acertos: a.acertos,
        total: a.total,
        data: p.data_feita,
      };
    })
    .sort((a, b) => a.t - b.t);
}

/** Texto da tendência: "De Abril/26 a Junho/26: 60,0% → 65,0% (subindo, +5,0 pts)." */
export function tendencia(pontos: PontoArea[]): string | null {
  if (pontos.length < 2) return null;
  const ini = pontos[0]!;
  const fim = pontos[pontos.length - 1]!;
  const delta = arred1(fim.pct - ini.pct);
  const tend = delta > 0 ? "subindo" : delta < 0 ? "caindo" : "estável";
  return `De ${mesAno(ini.data)} a ${mesAno(fim.data)}: ${fmtPct(ini.pct)} → ${fmtPct(fim.pct)} (${tend}, ${fmtSinal(delta)} pts).`;
}

export interface BancaArea {
  banca: string;
  pct: number;
  provas: number;
}

/** Desempenho numa área, banca a banca (só faz sentido com 2+ bancas). */
export function areaPorBanca(area: string, areas: Area[], provas: Prova[]): BancaArea[] {
  const porId = new Map(provas.map((p) => [p.id, p]));
  const m = new Map<string, { acertos: number; total: number; ids: Set<number> }>();
  for (const a of areas) {
    if (a.area !== area || !temNota(a)) continue;
    const p = porId.get(a.prova_id);
    if (!p) continue;
    const cur = m.get(p.banca) ?? { acertos: 0, total: 0, ids: new Set<number>() };
    cur.acertos += a.acertos;
    cur.total += a.total;
    cur.ids.add(p.id);
    m.set(p.banca, cur);
  }
  return [...m.entries()]
    .map(([banca, v]) => ({ banca, pct: pct(v.acertos, v.total)!, provas: v.ids.size }))
    .sort((a, b) => b.pct - a.pct);
}

/** Cor da nota em relação à meta: verde (bateu), amarelo (até 10% abaixo), vermelho. */
export function faixa(v: number, meta: number): "bom" | "perto" | "ruim" {
  if (v >= meta) return "bom";
  if (v >= meta * 0.9) return "perto";
  return "ruim";
}

/** Nome curto de uma prova nos seletores. */
export function nomeProva(p: Prova): string {
  return `${p.banca} ${p.ano}${p.data_feita ? ` · ${mesAno(p.data_feita)}` : ""}`;
}

/* ======================================================================
 * Diagnóstico de uma banca-alvo (USP-SP): onde ganhar pontos até a prova
 * ====================================================================== */

/** Quantas provas mais recentes contam como "fase atual". */
export const N_RECENTES = 3;

/**
 * Plano para a prova-alvo: meta (%) e número de questões de cada área.
 * A USP-SP deste ano terá 100 questões; o padrão divide como nas provas antigas (20/20/20/10/10/20).
 */
export interface PlanoFoco {
  metas: Record<string, number>;
  questoes: Record<string, number>;
}

export const QUESTOES_PADRAO: Record<string, number> = {
  "Clínica Médica": 20,
  Cirurgia: 20,
  Pediatria: 20,
  Ginecologia: 10,
  Obstetrícia: 10,
  Preventiva: 20,
};

export function planoPadrao(meta: number): PlanoFoco {
  return {
    metas: Object.fromEntries(AREAS.map((a) => [a, meta])),
    questoes: { ...QUESTOES_PADRAO },
  };
}

/** Confere um plano vindo do banco (ou de um formulário); completa o que faltar com o padrão. */
export function normalizarPlano(bruto: unknown, meta: number): PlanoFoco {
  const base = planoPadrao(meta);
  const obj = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<PlanoFoco>;
  const ok = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
  for (const a of AREAS) {
    const m = obj.metas?.[a];
    const q = obj.questoes?.[a];
    if (ok(m, 30, 100)) base.metas[a] = m as number;
    if (ok(q, 0, 80)) base.questoes[a] = q as number;
  }
  return base;
}

/** Erro de validação do plano (ou null). */
export function validarPlano(p: PlanoFoco): string | null {
  for (const a of AREAS) {
    const m = p.metas[a];
    const q = p.questoes[a];
    if (typeof m !== "number" || !Number.isInteger(m) || m < 30 || m > 100) return `${a}: a meta vai de 30% a 100%.`;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 0 || q > 80) return `${a}: questões de 0 a 80.`;
  }
  const total = AREAS.reduce((s, a) => s + p.questoes[a]!, 0);
  if (total < 1 || total > 200) return "O total de questões da prova deve ficar entre 1 e 200.";
  return null;
}

export interface DiagArea {
  area: string;
  meta: number;
  /** questões dessa área na prova-alvo */
  questoes: number;
  pctGeral: number;
  pctRecente: number;
  /** pontos de diferença: recentes − anteriores (null se não há provas anteriores) */
  tendencia: number | null;
  /** questões a mais nessa área para chegar na meta dela (0 se já chegou) */
  ganho: number;
  /** questões acima da meta (0 se ainda não chegou) */
  folga: number;
  nProvas: number;
}

export interface Diagnostico {
  nProvas: number;
  nCompletas: number;
  media: number | null;
  ultima: ProvaComPct | null;
  primeira: ProvaComPct | null;
  melhor: ProvaComPct | null;
  pctRecente: number | null;
  /** pontos: média das recentes − média das anteriores */
  tendencia: number | null;
  /** prova-alvo */
  totalQuestoes: number;
  metaQuestoes: number;
  metaPct: number;
  /** quantas questões você faria hoje na prova-alvo (fase atual, área por área) */
  atualQuestoes: number | null;
  /** idem, com as notas da última prova */
  ultimaQuestoes: number | null;
  areas: DiagArea[]; // da maior prioridade para a menor
  pendentes: { prova: Prova; areas: string[] }[];
  anosFaltando: number[];
}

const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function diagnostico(
  provas: Prova[],
  areas: Area[],
  plano: PlanoFoco,
  banca = BANCA_FOCO,
): Diagnostico | null {
  const doFoco = provas
    .filter((p) => p.banca === banca)
    .sort((a, b) => dataMs(a.data_feita) - dataMs(b.data_feita) || a.id - b.id);
  if (doFoco.length === 0) return null;
  const ids = new Set(doFoco.map((p) => p.id));
  const areasFoco = areas.filter((a) => ids.has(a.prova_id));

  // geral: só provas completas, em ordem de data
  const comp = provasCompletas(doFoco, areasFoco).sort(
    (a, b) => dataMs(a.data_feita) - dataMs(b.data_feita) || a.id - b.id,
  );
  const recentes = comp.slice(-N_RECENTES);
  const anteriores = comp.slice(0, -N_RECENTES);
  const pctRecente = recentes.length ? pct(soma(recentes.map((p) => p.acertos)), soma(recentes.map((p) => p.total_questoes))) : null;
  const pctAnt = anteriores.length ? pct(soma(anteriores.map((p) => p.acertos)), soma(anteriores.map((p) => p.total_questoes))) : null;

  // prova-alvo
  const totalQuestoes = soma(AREAS.map((a) => plano.questoes[a] ?? 0));
  const metaQuestoes = soma(AREAS.map((a) => ((plano.metas[a] ?? 0) / 100) * (plano.questoes[a] ?? 0)));
  const metaPct = totalQuestoes ? (metaQuestoes / totalQuestoes) * 100 : 0;

  // por área: a ordem das provas define o que é "recente"
  const ordem = new Map(doFoco.map((p, i) => [p.id, i]));
  const diagAreas: DiagArea[] = [];
  for (const ar of AREAS) {
    const linhas = areasFoco
      .filter((a) => a.area === ar && temNota(a))
      .sort((a, b) => ordem.get(a.prova_id)! - ordem.get(b.prova_id)!);
    if (linhas.length === 0) continue;
    const rec = linhas.slice(-N_RECENTES);
    const ant = linhas.slice(0, -N_RECENTES);
    const pRec = pct(soma(rec.map((a) => a.acertos)), soma(rec.map((a) => a.total)))!;
    const pAnt = ant.length ? pct(soma(ant.map((a) => a.acertos)), soma(ant.map((a) => a.total))) : null;
    const meta = plano.metas[ar] ?? 70;
    const q = plano.questoes[ar] ?? 0;
    diagAreas.push({
      area: ar,
      meta,
      questoes: q,
      pctGeral: pct(soma(linhas.map((a) => a.acertos)), soma(linhas.map((a) => a.total)))!,
      pctRecente: pRec,
      tendencia: pAnt === null ? null : arred1(pRec - pAnt),
      ganho: arred1(Math.max(0, ((meta - pRec) / 100) * q)),
      folga: arred1(Math.max(0, ((pRec - meta) / 100) * q)),
      nProvas: linhas.length,
    });
  }
  diagAreas.sort((a, b) => b.ganho - a.ganho || a.pctRecente - b.pctRecente);

  // "quantas questões você faria" na prova-alvo, área por área
  const naProvaAlvo = (pcts: Map<string, number>) => {
    if (AREAS.some((a) => (plano.questoes[a] ?? 0) > 0 && !pcts.has(a))) return null;
    return soma(AREAS.map((a) => ((pcts.get(a) ?? 0) / 100) * (plano.questoes[a] ?? 0)));
  };
  const atualQuestoes = naProvaAlvo(new Map(diagAreas.map((d) => [d.area, d.pctRecente])));
  const ultima = comp[comp.length - 1] ?? null;
  const ultimaQuestoes = ultima
    ? naProvaAlvo(
        new Map(
          areasFoco
            .filter((a) => a.prova_id === ultima.id && temNota(a))
            .map((a) => [a.area, (a.acertos / a.total) * 100] as const),
        ),
      )
    : null;

  // erros ainda não estudados, da prova mais recente para a mais antiga
  const pendentes = [...doFoco]
    .reverse()
    .map((p) => ({
      prova: p,
      areas: areasFoco.filter((a) => a.prova_id === p.id && a.status === FIZ && !a.estudada).map((a) => a.area),
    }))
    .filter((x) => x.areas.length > 0);

  // anos que ficaram faltando entre a prova mais antiga e a mais nova que você já fez
  const anos = new Set(doFoco.map((p) => p.ano));
  const anosFaltando: number[] = [];
  const minAno = Math.min(...anos);
  const maxAno = Math.max(...anos);
  for (let a = minAno + 1; a < maxAno; a++) if (!anos.has(a)) anosFaltando.push(a);

  let melhor: ProvaComPct | null = null;
  for (const p of comp) if (!melhor || p.pct > melhor.pct) melhor = p;

  return {
    nProvas: doFoco.length,
    nCompletas: comp.length,
    media: comp.length ? soma(comp.map((p) => p.pct)) / comp.length : null,
    ultima,
    primeira: comp[0] ?? null,
    melhor,
    pctRecente,
    tendencia: pctRecente !== null && pctAnt !== null ? arred1(pctRecente - pctAnt) : null,
    totalQuestoes,
    metaQuestoes: arred1(metaQuestoes),
    metaPct: arred1(metaPct),
    atualQuestoes: atualQuestoes === null ? null : arred1(atualQuestoes),
    ultimaQuestoes: ultimaQuestoes === null ? null : arred1(ultimaQuestoes),
    areas: diagAreas,
    pendentes,
    anosFaltando,
  };
}

/** Dias inteiros de hoje até a data (AAAA-MM-DD); null se não houver data. */
export function diasAte(data: string | null, hoje = new Date()): number | null {
  if (!data) return null;
  const alvo = dataMs(data);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86400000);
}

/** "≈ 4,8" (uma casa) */
export function fmtNum1(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/** Só as provas (e suas áreas) de uma banca. */
export function filtrarBanca(provas: Prova[], areas: Area[], banca: string) {
  const ps = provas.filter((p) => p.banca === banca);
  const ids = new Set(ps.map((p) => p.id));
  return { provas: ps, areas: areas.filter((a) => ids.has(a.prova_id)) };
}

/* ======================================================================
 * Análises avançadas (modo foco): consistência, média móvel, foco da semana
 * ====================================================================== */

export type Perfil = "pilar" | "volatil" | "base" | "evolucao";
export const PERFIL_LABEL: Record<Perfil, string> = {
  pilar: "Pilar seguro",
  volatil: "Volátil",
  base: "Base estável",
  evolucao: "Em evolução",
};

export interface Consistencia {
  area: string;
  n: number;
  media: number;
  dp: number; // desvio padrão em pontos
  min: number;
  max: number;
  perfil: Perfil;
  /** quantos pontos percentuais vale 1 questão nessa área (pela média de questões por prova) */
  pontosPorQuestao: number;
}

function desvio(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = soma(xs) / xs.length;
  return Math.sqrt(soma(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

/**
 * Média, oscilação (desvio padrão) e faixa de cada área nas provas da banca.
 * Pilar seguro = acima da sua média geral e oscila pouco; volátil = oscila muito.
 */
export function consistencia(provas: Prova[], areas: Area[], banca = BANCA_FOCO): Consistencia[] {
  const f = filtrarBanca(provas, areas, banca);
  const comNota = f.areas.filter(temNota);
  const todas = comNota.map((a) => (a.acertos / a.total) * 100);
  const mediaGeral = todas.length ? soma(todas) / todas.length : 0;
  const res: Consistencia[] = [];
  for (const ar of AREAS) {
    const linhas = comNota.filter((a) => a.area === ar);
    if (linhas.length === 0) continue;
    const pcts = linhas.map((a) => (a.acertos / a.total) * 100);
    const media = soma(pcts) / pcts.length;
    const dp = desvio(pcts);
    const perfil: Perfil =
      dp > 12 ? "volatil" : media >= mediaGeral ? (dp <= 10 ? "pilar" : "evolucao") : dp <= 10 ? "base" : "evolucao";
    res.push({
      area: ar,
      n: linhas.length,
      media: arred1(media),
      dp: arred1(dp),
      min: arred1(Math.min(...pcts)),
      max: arred1(Math.max(...pcts)),
      perfil,
      pontosPorQuestao: arred1(100 / (soma(linhas.map((a) => a.total)) / linhas.length)),
    });
  }
  return res;
}

export interface PontoTempo {
  id: number;
  t: number;
  ano: number;
  rotulo: string;
  pct: number;
  /** média das últimas 3 provas até esta (inclusive) */
  movel: number;
}

/** Provas completas da banca em ordem de data, com média móvel de 3. */
export function serieTempo(provas: Prova[], areas: Area[], banca = BANCA_FOCO, janela = 3): PontoTempo[] {
  const f = filtrarBanca(provas, areas, banca);
  const comp = provasCompletas(f.provas, f.areas)
    .filter((p) => p.data_feita)
    .sort((a, b) => dataMs(a.data_feita) - dataMs(b.data_feita) || a.id - b.id);
  return comp.map((p, i) => {
    const jan = comp.slice(Math.max(0, i - janela + 1), i + 1);
    return {
      id: p.id,
      t: dataMs(p.data_feita),
      ano: p.ano,
      rotulo: `${p.banca} ${p.ano}`,
      pct: p.pct,
      movel: arred1(soma(jan.map((x) => x.pct)) / jan.length),
    };
  });
}

export interface CelulaMapa {
  area: string;
  pct: number | null;
  acertos: number;
  total: number;
  status: string | null;
}
export interface LinhaMapa {
  prova: Prova;
  geral: number | null;
  celulas: CelulaMapa[];
}

/** Mapa de calor: cada prova da banca (mais antiga em cima) × cada área. */
export function mapaCalor(provas: Prova[], areas: Area[], banca = BANCA_FOCO): LinhaMapa[] {
  const f = filtrarBanca(provas, areas, banca);
  return [...f.provas]
    .sort((a, b) => dataMs(a.data_feita) - dataMs(b.data_feita) || a.id - b.id)
    .map((p) => {
      const ap = f.areas.filter((a) => a.prova_id === p.id);
      return {
        prova: p,
        geral: pct(p.acertos, p.total_questoes),
        celulas: AREAS.map((ar) => {
          const a = ap.find((x) => x.area === ar);
          return {
            area: ar,
            pct: a && temNota(a) ? pct(a.acertos, a.total) : null,
            acertos: a?.acertos ?? 0,
            total: a?.total ?? 0,
            status: a?.status ?? null,
          };
        }),
      };
    });
}

export interface FocoSemana {
  area: string;
  pctArea: number;
  /** pontos abaixo da sua média geral recente */
  abaixo: number;
  /** acertos hoje nessa área, na prova-alvo */
  acertosHoje: number;
  questoes: number;
  /** acertos extras para subir +5 pontos na nota geral (5% da prova) */
  extras: number;
  /** cabe tudo nessa área? (se não, mostra a divisão) */
  cabe: boolean;
  /** alternativa: dividir os acertos extras entre as áreas que mais rendem */
  divisao: { area: string; extras: number }[];
}

/**
 * A área que mais puxa a nota para baixo nas últimas provas (peso = nº de questões)
 * e quantos acertos a mais ela precisa para a nota geral subir 5 pontos.
 */
export function focoDaSemana(d: Diagnostico, subir = 5): FocoSemana | null {
  if (d.pctRecente === null || d.areas.length === 0 || d.totalQuestoes === 0) return null;
  const geral = d.pctRecente;
  // a área que mais te afasta das SUAS metas (já pesa nº de questões); se todas já bateram,
  // a que mais puxa a nota para baixo: (pct da área − pct geral) × questões
  const pior =
    d.areas.find((a) => a.ganho > 0 && a.questoes > 0) ??
    [...d.areas]
      .filter((a) => a.questoes > 0)
      .sort((a, b) => (a.pctRecente - geral) * a.questoes - (b.pctRecente - geral) * b.questoes)[0];
  if (!pior) return null;
  const extras = Math.ceil((subir / 100) * d.totalQuestoes);
  const acertosHoje = (pior.pctRecente / 100) * pior.questoes;
  const cabe = pior.questoes - acertosHoje >= extras;

  // divisão entre as áreas com mais a ganhar (proporcional ao que cada uma pode render)
  const candidatas = d.areas.filter((a) => a.ganho > 0).slice(0, 3);
  const somaGanho = soma(candidatas.map((a) => a.ganho));
  let divisao = candidatas.map((a) => ({ area: a.area, extras: somaGanho ? Math.round((a.ganho / somaGanho) * extras) : 0 }));
  const dif = extras - soma(divisao.map((x) => x.extras));
  if (divisao[0]) divisao[0].extras += dif;
  divisao = divisao.filter((x) => x.extras > 0);

  return {
    area: pior.area,
    pctArea: pior.pctRecente,
    abaixo: arred1(geral - pior.pctRecente),
    acertosHoje: arred1(acertosHoje),
    questoes: pior.questoes,
    extras,
    cabe,
    divisao,
  };
}

/* ======================================================================
 * Caderno de erros: motivos e temas (Pareto)
 * ====================================================================== */

export const MOTIVOS = [
  { id: "base", texto: "Falta de base teórica", dica: "revise a teoria dos temas que mais erra (resumo + questões do tema)" },
  { id: "atencao", texto: "Desatenção / leitura do enunciado", dica: "leia a pergunta final antes do caso e marque palavras como EXCETO, INCORRETA, MAIS PROVÁVEL" },
  { id: "imagem", texto: "Imagem ou exame complementar", dica: "treine com banco de imagens: ECG, raio-x, dermato, partograma" },
  { id: "duvida", texto: "Dúvida entre 2 alternativas", dica: "anote o que diferencia as duas opções e transforme em flashcard de diagnóstico diferencial" },
  { id: "memoria", texto: "Sabia, mas esqueci", dica: "passe para o Anki e revise espaçado" },
  { id: "outro", texto: "Outro motivo", dica: "" },
] as const;
export type MotivoId = (typeof MOTIVOS)[number]["id"];
export const MOTIVO_TEXTO: Record<string, string> = Object.fromEntries(MOTIVOS.map((m) => [m.id, m.texto]));

export interface ErroReg {
  id: number;
  prova_id: number | null;
  area: string;
  tema: string;
  motivo: string;
  anotacao: string;
  numero: number | null;
  card: boolean;
}

export interface BarraPareto {
  chave: string;
  texto: string;
  n: number;
  pct: number;
  acumulado: number;
}

/** Contagem do maior para o menor, com % acumulado (os poucos que causam a maioria). */
export function pareto(itens: string[], rotulo: (k: string) => string = (k) => k): BarraPareto[] {
  const cont = new Map<string, number>();
  for (const k of itens) if (k) cont.set(k, (cont.get(k) ?? 0) + 1);
  const total = itens.filter(Boolean).length;
  let acc = 0;
  return [...cont.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([k, n]) => {
      acc += n;
      return { chave: k, texto: rotulo(k), n, pct: arred1((n / total) * 100), acumulado: arred1((acc / total) * 100) };
    });
}

/** "  Pré-eclâmpsia " e "pré-eclâmpsia" contam como o mesmo tema. */
export function chaveTema(t: string): string {
  return t.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Linhas para a planilha (CSV, separado por ";" para abrir direto no Excel em português). */
export function csvProvas(provas: Prova[], areas: Area[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cab = ["banca", "ano", "data", "acertos", "total", "percentual"];
  for (const a of AREAS) cab.push(`${a} acertos`, `${a} total`, `${a} status`, `${a} erros estudados`);
  const linhas = [cab.map(esc).join(";")];
  for (const p of [...provas].sort((a, b) => dataMs(a.data_feita) - dataMs(b.data_feita))) {
    const ap = areas.filter((a) => a.prova_id === p.id);
    const v = pct(p.acertos, p.total_questoes);
    const lin: unknown[] = [p.banca, p.ano, p.data_feita ?? "", p.acertos, p.total_questoes, v === null ? "" : String(v).replace(".", ",")];
    for (const ar of AREAS) {
      const a = ap.find((x) => x.area === ar);
      lin.push(a?.acertos ?? "", a?.total ?? "", a ? STATUS_LABEL[a.status as Status] ?? a.status : "", a ? (a.estudada ? "sim" : "não") : "");
    }
    linhas.push(lin.map(esc).join(";"));
  }
  return linhas.join("\n");
}
