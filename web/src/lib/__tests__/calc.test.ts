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
