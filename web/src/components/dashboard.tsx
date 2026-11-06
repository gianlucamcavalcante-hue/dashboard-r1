"use client";

import { Aviso, Card, Info, Metrica, Secao, Tabela, corFaixa } from "./comum";
import { GraficoAreas, GraficoBancas, GraficoEvolucao } from "./graficos";
import { DesempenhoPorArea, EvolucaoPorArea } from "./provas";
import {
  agregarPorArea,
  BANCA_FOCO,
  estudoDosErros,
  evolucaoPorBanca,
  faixa,
  fmtPct,
  fmtSinal,
  kpis,
  mediaPorBanca,
  type Area,
  type Prova,
} from "@/lib/calc";

export default function Dashboard({ provas, areas, meta }: { provas: Prova[]; areas: Area[]; meta: number }) {
  if (provas.length === 0) {
    return <Info>Nenhuma prova cadastrada. Adicione provas na aba Provas.</Info>;
  }

  const k = kpis(provas, areas, meta);
  if (!k) {
    return (
      <div className="space-y-4">
        <Info>
          Você ainda não tem nenhuma prova <b>completa</b> (todas as áreas feitas e corrigidas). As estatísticas
          principais só consideram provas completas: termine de corrigir alguma na aba Provas.
        </Info>
        <div className="max-w-xs">
          <Metrica rotulo="Provas cadastradas" valor={provas.length} />
        </div>
      </div>
    );
  }

  const series = evolucaoPorBanca(provas, areas);
  const porArea = agregarPorArea(areas);
  const porBanca = mediaPorBanca(provas, areas);

  return (
    <div>
      {/* números do topo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metrica
          rotulo="Provas completas"
          valor={k.completas}
          detalhe={k.incompletas ? `${k.incompletas} incompleta(s)` : undefined}
        />
        <Metrica
          rotulo="Média geral"
          valor={fmtPct(k.media)}
          detalhe={`${fmtSinal(k.gap)} pts vs meta (${meta}%)`}
          corDetalhe={corFaixa(faixa(k.media, meta))}
        />
        <Metrica rotulo="Melhor prova" valor={fmtPct(k.melhor.pct)} detalhe={`${k.melhor.banca} ${k.melhor.ano}`} />
        <Metrica rotulo="Pior prova" valor={fmtPct(k.pior.pct)} detalhe={`${k.pior.banca} ${k.pior.ano}`} />
        <div className="col-span-2 lg:col-span-1">
          <Metrica
            rotulo={`Média ${BANCA_FOCO}`}
            valor={k.mediaFoco === null ? "—" : fmtPct(k.mediaFoco)}
            detalhe={k.mediaFoco === null ? undefined : `${fmtSinal(k.mediaFoco - meta)} pts vs meta`}
            corDetalhe={k.mediaFoco === null ? undefined : corFaixa(faixa(k.mediaFoco, meta))}
          />
        </div>
      </div>
      {k.incompletas > 0 && (
        <p className="mt-2 text-xs text-muted">
          {k.incompletas} prova(s) incompleta(s) (faltam áreas feitas ou sem nota) não entram nas médias, melhor e pior
          prova acima.
        </p>
      )}

      <Secao titulo="Evolução do desempenho">
        <Card>
          <GraficoEvolucao series={series} meta={meta} />
        </Card>
      </Secao>

      <div>
        <Secao titulo="Desempenho por banca" sub="Média das provas completas de cada banca.">
          <Card>
            <GraficoBancas dados={porBanca} meta={meta} />
          </Card>
        </Secao>
      </div>

      <DesempenhoPorArea provas={provas} areas={areas} meta={meta} soFoco={false} />
      <EvolucaoPorArea provas={provas} areas={areas} meta={meta} />

      <EstudoErros areas={areas} />
    </div>
  );
}

/** Quantas áreas feitas já tiveram os erros estudados. */
export function EstudoErros({ areas }: { areas: Area[] }) {
  const estudo = estudoDosErros(areas);
  if (!estudo) return null;
  return (
        <Secao titulo="📚 Estudo dos erros">
          <Card>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                {estudo.estudadas} de {estudo.feitas} áreas feitas com os erros já estudados
              </span>
              <span className="num font-semibold">{Math.round((estudo.estudadas / estudo.feitas) * 100)}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card2">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(estudo.estudadas / estudo.feitas) * 100}%` }}
              />
            </div>
            <div className="mt-4">
              <Tabela
                colunas={["Área", "Feitas", "Estudadas", "Faltam"]}
                alinharDireita={[1, 2, 3]}
                linhas={estudo.porArea.map((a) => [
                  a.area,
                  a.feitas,
                  a.estudadas,
                  <span key="f" className={a.faltam > 0 ? "font-semibold text-warn" : "text-muted"}>
                    {a.faltam}
                  </span>,
                ])}
              />
            </div>
            <p className="mt-3 text-sm text-muted">
              {estudo.porArea.some((a) => a.faltam > 0)
                ? "🟡 Ainda com erros a estudar em: " +
                  estudo.porArea
                    .filter((a) => a.faltam > 0)
                    .map((a) => a.area)
                    .join(", ")
                : "✅ Você já estudou os erros de todas as áreas que fez. Mandou bem!"}
            </p>
          </Card>
        </Secao>
  );
}
