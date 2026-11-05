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
