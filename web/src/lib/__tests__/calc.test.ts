import { describe, expect, it } from "vitest";
import {
  AREAS,
  agregarPorArea,
  areaPorBanca,
  estudoDosErros,
  evolucaoDaArea,
  fmtPct,
  idsCompletas,
  kpis,
  mediaPorBanca,
  mesAno,
  resumoProva,
  tendencia,
  type Area,
  type Prova,
} from "../calc";

let idArea = 1;
function areasCheias(provaId: number, notas: [number, number][], estudadas = 0): Area[] {
  return AREAS.map((area, i) => ({
    id: idArea++,
    prova_id: provaId,
    area,
    acertos: notas[i]![0],
    total: notas[i]![1],
    status: "feita",
    estudada: i < estudadas,
  }));
}
const seis = (a: number, t: number): [number, number][] => AREAS.map(() => [a, t]);

const provas: Prova[] = [
  { id: 3, banca: "UNESP", ano: 2025, data_feita: "2026-06-10", total_questoes: 60, acertos: 30 },
  { id: 2, banca: "USP-SP", ano: 2024, data_feita: "2026-05-01", total_questoes: 120, acertos: 96 },
  { id: 1, banca: "USP-SP", ano: 2023, data_feita: "2026-04-01", total_questoes: 120, acertos: 72 },
];
const areas: Area[] = [
  ...areasCheias(1, seis(12, 20), 6),
  ...areasCheias(2, seis(16, 20), 3),
  // prova 3: só 3 áreas com nota (incompleta) e uma "não fiz"
  ...areasCheias(3, [[10, 20], [10, 20], [10, 20], [0, 0], [0, 0], [0, 0]]).map((a, i) =>
    i === 5 ? { ...a, status: "nao_fiz" } : a,
  ),
];

describe("contas do painel", () => {
  it("só conta como completa a prova com as 6 áreas com nota", () => {
    expect([...idsCompletas(areas)].sort()).toEqual([1, 2]);
  });

  it("números do topo usam só as completas", () => {
    const k = kpis(provas, areas, 70)!;
    expect(k.completas).toBe(2);
    expect(k.incompletas).toBe(1);
    expect(k.media).toBeCloseTo(70);
    expect(k.melhor.id).toBe(2);
    expect(k.pior.id).toBe(1);
    expect(k.mediaFoco).toBeCloseTo(70);
  });

  it("área: soma de todas as áreas com nota, da pior para a melhor", () => {
    const ag = agregarPorArea(areas);
    expect(ag[0]!.pct).toBe(63.3); // as 3 primeiras somam USP + UNESP (50%)
    expect(ag[ag.length - 1]!.pct).toBe(70); // as sem nota na UNESP ficam só com USP
    const cm = ag.find((a) => a.area === "Clínica Médica")!;
    expect(cm.acertos).toBe(38);
    expect(cm.total).toBe(60);
    expect(cm.pct).toBe(63.3);
  });

  it("média por banca só com completas", () => {
    expect(mediaPorBanca(provas, areas)).toEqual([{ banca: "USP-SP", media: 70, provas: 2 }]);
  });

  it("situação de cada prova", () => {
    expect(resumoProva(areas.filter((a) => a.prova_id === 1)).categoria).toBe("concluida");
    const r2 = resumoProva(areas.filter((a) => a.prova_id === 2));
    expect(r2.categoria).toBe("revisar");
    expect(r2.label).toBe("Falta estudar (3/6)");
    const r3 = resumoProva(areas.filter((a) => a.prova_id === 3));
    expect(r3.label).toBe("Parcial (3/6 áreas)");
    expect(r3.naoFiz).toEqual(["Preventiva"]);
  });

  it("estudo dos erros", () => {
    const e = estudoDosErros(areas)!;
    expect(e.feitas).toBe(17);
    expect(e.estudadas).toBe(9);
  });

  it("evolução e tendência de uma área", () => {
    const p = evolucaoDaArea("Clínica Médica", areas, provas);
    expect(p.map((x) => x.pct)).toEqual([60, 80, 50]);
    expect(tendencia(p)).toBe("De Abril/26 a Junho/26: 60,0% → 50,0% (caindo, −10,0 pts).");
  });

  it("área por banca", () => {
    expect(areaPorBanca("Clínica Médica", areas, provas)).toEqual([
      { banca: "USP-SP", pct: 70, provas: 2 },
      { banca: "UNESP", pct: 50, provas: 1 },
    ]);
  });

  it("formatos", () => {
    expect(fmtPct(65.25)).toBe("65,3%");
    expect(fmtPct(null)).toBe("—");
    expect(mesAno("2026-12-31")).toBe("Dezembro/26");
  });
});

import { diagnostico, diasAte, filtrarBanca, normalizarPlano, planoPadrao, validarPlano } from "../calc";

describe("diagnóstico USP-SP", () => {
  // 4 provas USP-SP completas: Cirurgia vai mal e não melhora; Pediatria melhora
  const ps: Prova[] = [1, 2, 3, 4].map((i) => ({
    id: 100 + i,
    banca: "USP-SP",
    ano: 2017 + i + (i === 4 ? 1 : 0), // 2018, 2019, 2020, 2022 (falta 2021)
    data_feita: `2026-0${i}-10`,
    total_questoes: 0,
    acertos: 0,
  }));
  const as: Area[] = ps.flatMap((p, k) =>
    AREAS.map((area) => {
      const total = area === "Ginecologia" || area === "Obstetrícia" ? 12 : 24;
      const acertos =
        area === "Cirurgia" ? 10 : area === "Pediatria" ? [10, 12, 18, 20][k]! : Math.round(total * 0.7);
      return { id: idArea++, prova_id: p.id, area, acertos, total, status: "feita", estudada: k < 3 };
    }),
  );
  for (const p of ps) {
    const ap = as.filter((a) => a.prova_id === p.id);
    p.total_questoes = ap.reduce((s, a) => s + a.total, 0);
    p.acertos = ap.reduce((s, a) => s + a.acertos, 0);
  }
  const outra: Prova = { id: 999, banca: "UNESP", ano: 2019, data_feita: "2026-05-01", total_questoes: 10, acertos: 10 };

  const plano = planoPadrao(70);
  const d = diagnostico([...ps, outra], as, plano)!;

  it("ignora outras bancas", () => {
    expect(d.nProvas).toBe(4);
    expect(filtrarBanca([...ps, outra], as, "USP-SP").provas).toHaveLength(4);
  });

  it("prova-alvo de 100 questões", () => {
    expect(d.totalQuestoes).toBe(100);
    expect(d.metaQuestoes).toBe(70);
    expect(d.metaPct).toBe(70);
  });

  it("Cirurgia é a prioridade, pesada pelas 20 questões da prova de 100", () => {
    expect(d.areas[0]!.area).toBe("Cirurgia");
    expect(d.areas[0]!.pctRecente).toBe(41.7);
    expect(d.areas[0]!.ganho).toBe(5.7); // (70 − 41,7)% de 20
    expect(d.areas[0]!.tendencia).toBe(0);
  });

  it("Pediatria mostra a melhora recente", () => {
    const ped = d.areas.find((a) => a.area === "Pediatria")!;
    expect(ped.pctRecente).toBe(69.4);
    expect(ped.tendencia).toBe(27.7);
  });

  it("meta por área muda a prioridade", () => {
    const p2 = planoPadrao(70);
    p2.metas["Obstetrícia"] = 95;
    p2.metas["Cirurgia"] = 45;
    const d2 = diagnostico(ps, as, p2)!;
    expect(d2.areas[0]!.area).toBe("Obstetrícia"); // (95 − 66,7)% de 10 = 2,8 > Cirurgia (0,7)
    expect(d2.areas.find((a) => a.area === "Cirurgia")!.ganho).toBe(0.7);
  });

  it("área na meta tem folga e não pede questões", () => {
    const prev = d.areas.find((a) => a.area === "Preventiva")!;
    expect(prev.ganho).toBe(0);
    expect(prev.folga).toBeGreaterThanOrEqual(0);
  });

  it("questões que você faria na prova de 100", () => {
    expect(d.atualQuestoes).not.toBeNull();
    expect(d.ultimaQuestoes).not.toBeNull();
    expect(d.ultimaQuestoes!).toBeGreaterThan(d.atualQuestoes! - 1);
  });

  it("primeira, melhor, pendências e anos que faltam", () => {
    expect(d.primeira!.id).toBe(101);
    expect(d.ultima!.id).toBe(104);
    expect(d.melhor!.id).toBe(104);
    expect(d.pendentes[0]!.prova.id).toBe(104);
    expect(d.anosFaltando).toEqual([2021]);
  });

  it("plano: completa o que falta e valida", () => {
    const n = normalizarPlano({ metas: { Cirurgia: 50, Pediatria: 999 } }, 75);
    expect(n.metas["Cirurgia"]).toBe(50);
    expect(n.metas["Pediatria"]).toBe(75);
    expect(n.questoes["Ginecologia"]).toBe(10);
    expect(validarPlano(n)).toBeNull();
    expect(validarPlano({ ...n, metas: { ...n.metas, Cirurgia: 20 } })).toMatch(/Cirurgia/);
  });

  it("contagem de dias", () => {
    expect(diasAte("2026-12-06", new Date(2026, 10, 5))).toBe(31);
    expect(diasAte(null)).toBeNull();
  });
});

import { consistencia, csvProvas, focoDaSemana, mapaCalor, pareto, chaveTema, serieTempo } from "../calc";

describe("análises avançadas", () => {
  // 3 provas USP-SP: Obstetrícia oscila muito; Preventiva alta e estável; Cirurgia baixa e estável
  const ps: Prova[] = [1, 2, 3].map((i) => ({
    id: 200 + i, banca: "USP-SP", ano: 2018 + i, data_feita: `2026-0${i}-01`, total_questoes: 0, acertos: 0,
  }));
  const notas: Record<string, number[]> = {
    "Clínica Médica": [12, 12, 13], Cirurgia: [10, 10, 11], Pediatria: [14, 14, 14],
    Ginecologia: [6, 6, 6], Obstetrícia: [3, 10, 5], Preventiva: [18, 19, 18],
  };
  const as: Area[] = ps.flatMap((p, k) =>
    AREAS.map((area) => {
      const total = area === "Ginecologia" || area === "Obstetrícia" ? 10 : 20;
      return { id: idArea++, prova_id: p.id, area, acertos: notas[area]![k]!, total, status: "feita", estudada: true };
    }),
  );
  for (const p of ps) {
    const ap = as.filter((a) => a.prova_id === p.id);
    p.total_questoes = ap.reduce((s, a) => s + a.total, 0);
    p.acertos = ap.reduce((s, a) => s + a.acertos, 0);
  }

  it("classifica consistência", () => {
    const c = consistencia(ps, as);
    expect(c.find((x) => x.area === "Obstetrícia")!.perfil).toBe("volatil");
    expect(c.find((x) => x.area === "Preventiva")!.perfil).toBe("pilar");
    expect(c.find((x) => x.area === "Cirurgia")!.perfil).toBe("base");
    expect(c.find((x) => x.area === "Obstetrícia")!.pontosPorQuestao).toBe(10);
  });

  it("média móvel de 3", () => {
    const s = serieTempo(ps, as);
    expect(s).toHaveLength(3);
    expect(s[2]!.movel).toBeCloseTo((s[0]!.pct + s[1]!.pct + s[2]!.pct) / 3, 0);
  });

  it("mapa de calor em ordem de data", () => {
    const m = mapaCalor(ps, as);
    expect(m[0]!.prova.id).toBe(201);
    expect(m[0]!.celulas.find((c) => c.area === "Obstetrícia")!.pct).toBe(30);
  });

  it("foco da semana: área que mais puxa para baixo e acertos para +5 pts", () => {
    const d = diagnostico(ps, as, planoPadrao(80))!;
    const f = focoDaSemana(d)!;
    expect(f.area).toBe("Cirurgia"); // 51,7% com 20 questões pesa mais que Obstetrícia (60%, 10 questões)
    expect(f.extras).toBe(5);
    expect(f.cabe).toBe(true);
    expect(f.divisao.reduce((s, x) => s + x.extras, 0)).toBe(5);
  });

  it("pareto e temas", () => {
    const p = pareto(["a", "b", "a", "c", "a", "b"]);
    expect(p.map((x) => x.chave)).toEqual(["a", "b", "c"]);
    expect(p[0]!.acumulado).toBe(50);
    expect(p[2]!.acumulado).toBe(100);
    expect(chaveTema("  Pré-Eclâmpsia ")).toBe("pré-eclâmpsia");
  });

  it("planilha CSV", () => {
    const csv = csvProvas(ps, as);
    expect(csv.split("\n")).toHaveLength(4);
    expect(csv.split("\n")[0]).toContain("Obstetrícia acertos");
  });
});
