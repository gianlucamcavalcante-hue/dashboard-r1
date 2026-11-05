"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AMARELO,
  Aviso,
  Botao,
  Card,
  Chip,
  Info,
  Mensagem,
  Metrica,
  Recolhivel,
  ROXO,
  Secao,
  Selecao,
  Tabela,
  VERDE,
  classeCampo,
} from "./comum";
import { GraficoAreas, GraficoBancas, GraficoEvolucaoArea } from "./graficos";
import { FormAreas, conferir, linhasDe, linhasVazias, paraSalvar, type LinhaArea } from "./form-areas";
import { adicionarProva, atualizarProva, excluirProva } from "@/server/acoes";
import {
  AREAS,
  FIZ,
  NAO_FIZ,
  STATUS_LABEL,
  agregarPorArea,
  areaPorBanca,
  areasDaProva,
  evolucaoDaArea,
  fmtPct,
  mesAno,
  nomeProva,
  pct,
  pctDaLista,
  resumoProva,
  temNota,
  tendencia,
  type Area,
  type Categoria,
  type Prova,
  type Status,
} from "@/lib/calc";

const COR_CAT: Record<Categoria, string> = { concluida: VERDE, revisar: AMARELO, parcial: AMARELO, sem: ROXO };
const ICONE_CAT: Record<Categoria, string> = { concluida: "✅ ", revisar: "🟡 ", parcial: "🟡 ", sem: "⬜ " };

type Msg = { tipo: "ok" | "erro"; texto: string } | null;

export default function Provas({ provas, areas, meta }: { provas: Prova[]; areas: Area[]; meta: number }) {
  return (
    <div>
      {provas.length > 0 ? (
        <>
          <ListaProvas provas={provas} areas={areas} />
          <DesempenhoPorArea provas={provas} areas={areas} meta={meta} />
          <EvolucaoPorArea provas={provas} areas={areas} meta={meta} />
          <div className="mt-8">
            <AtualizarProva provas={provas} areas={areas} meta={meta} />
            <ExcluirProva provas={provas} />
          </div>
        </>
      ) : (
        <Info>Nenhuma prova cadastrada ainda. Adicione abaixo. 👇</Info>
      )}
      <NovaProva provas={provas} meta={meta} />
    </div>
  );
}

/* ---------------- lista com filtros ---------------- */

function ListaProvas({ provas, areas }: { provas: Prova[]; areas: Area[] }) {
  const [banca, setBanca] = useState("Todas");
  const [sit, setSit] = useState<Categoria | "todas">("todas");
  const [ano, setAno] = useState<number | 0>(0);

  const linhas = useMemo(
    () => provas.map((p) => ({ p, r: resumoProva(areasDaProva(areas, p.id)) })),
    [provas, areas],
  );
  const bancas = [...new Set(provas.map((p) => p.banca))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const anos = [...new Set(provas.map((p) => p.ano))].sort((a, b) => b - a);

  const filtradas = linhas.filter(
    ({ p, r }) =>
      (banca === "Todas" || p.banca === banca) && (ano === 0 || p.ano === ano) && (sit === "todas" || r.categoria === sit),
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Selecao
          rotulo="Banca"
          valor={banca}
          onChange={setBanca}
          opcoes={[{ valor: "Todas", texto: "Todas" }, ...bancas.map((b) => ({ valor: b, texto: b }))]}
        />
        <Selecao<Categoria | "todas">
          rotulo="Situação"
          valor={sit}
          onChange={setSit}
          opcoes={[
            { valor: "todas", texto: "Todas" },
            { valor: "concluida", texto: "✅ Concluída" },
            { valor: "revisar", texto: "🟡 Falta estudar" },
            { valor: "parcial", texto: "🟡 Parcial" },
            { valor: "sem", texto: "⬜ Sem notas" },
          ]}
        />
        <Selecao<number>
          rotulo="Ano"
          valor={ano}
          onChange={setAno}
          opcoes={[{ valor: 0, texto: "Todos" }, ...anos.map((a) => ({ valor: a, texto: String(a) }))]}
        />
      </div>
      <div className="mt-4">
        {filtradas.length === 0 ? (
          <Info>Nenhuma prova com esses filtros.</Info>
        ) : (
          <Tabela
            colunas={["Banca", "Ano", "Quando fiz", "% Acertos", "Situação", "Erros estudados", "Não fiz"]}
            linhas={filtradas.map(({ p, r }) => [
              <b key="b">{p.banca}</b>,
              p.ano,
              <span key="d" className="whitespace-nowrap">{mesAno(p.data_feita)}</span>,
              <b key="p" className="whitespace-nowrap">{pctDaLista(p, r)}</b>,
              <Chip key="c" texto={ICONE_CAT[r.categoria] + r.label} cor={COR_CAT[r.categoria]} />,
              r.nFeitas ? `${r.nEstudadas}/${r.nFeitas}` : "—",
              r.naoFiz.length ? (
                <span key="n" className="text-neg">{r.naoFiz.join(", ")}</span>
              ) : (
                <span key="n" className="text-muted">—</span>
              ),
            ])}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- desempenho por área (todas ou uma prova) ---------------- */

function DesempenhoPorArea({ provas, areas, meta }: { provas: Prova[]; areas: Area[]; meta: number }) {
  const [escolha, setEscolha] = useState<number>(0); // 0 = todas as provas
  const existe = escolha === 0 || provas.some((p) => p.id === escolha);
  const id = existe ? escolha : 0;

  return (
    <Secao titulo="📊 Desempenho por área">
      <Selecao<number>
        rotulo="Ver desempenho de:"
        valor={id}
        onChange={setEscolha}
        className="max-w-md"
        opcoes={[{ valor: 0, texto: "🌍 Todas as provas (global)" }, ...provas.map((p) => ({ valor: p.id, texto: nomeProva(p) }))]}
      />
      <div className="mt-4">
        {id === 0 ? <AreasGlobal areas={areas} meta={meta} /> : <AreasDaProva ap={areasDaProva(areas, id)} meta={meta} />}
      </div>
    </Secao>
  );
}

function AreasGlobal({ areas, meta }: { areas: Area[]; meta: number }) {
  const ag = agregarPorArea(areas);
  if (!ag.length) return <Info>Nenhuma área com nota ainda. Preencha acertos/total de alguma prova.</Info>;
  const semDados = AREAS.filter((a) => !ag.some((x) => x.area === a));
  return (
    <Card>
      <GraficoAreas dados={ag} meta={meta} />
      <Aviso>
        <b>Área prioritária: {ag[0]!.area}</b>: {fmtPct(ag[0]!.pct)} de acerto somando todas as provas.
      </Aviso>
      {semDados.length > 0 && <p className="mt-2 text-xs text-muted">Ainda sem notas em: {semDados.join(", ")}</p>}
    </Card>
  );
}

function AreasDaProva({ ap, meta }: { ap: Area[]; meta: number }) {
  if (!ap.length) return <Info>Sem dados de área para esta prova.</Info>;
  const ordem = (a: Area) => AREAS.indexOf(a.area as (typeof AREAS)[number]);
  const lista = [...ap].sort((a, b) => ordem(a) - ordem(b));
  const comNota = lista.filter(temNota);
  const naoFiz = lista.filter((a) => a.status === NAO_FIZ).map((a) => a.area);
  const ag = agregarPorArea(comNota);
  const somaAc = comNota.reduce((s, a) => s + a.acertos, 0);
  const somaTot = comNota.reduce((s, a) => s + a.total, 0);
  const completa = comNota.length === AREAS.length;

  return (
    <div className="space-y-4">
      {comNota.length > 0 ? (
        <>
          <div className="grid max-w-lg grid-cols-2 gap-3">
            <Metrica rotulo="Áreas com nota" valor={`${comNota.length}/${AREAS.length}`} />
            <Metrica rotulo={completa ? "Média (completa)" : "Média (áreas feitas)"} valor={fmtPct(pct(somaAc, somaTot))} />
          </div>
          <Card>
            <GraficoAreas dados={ag} meta={meta} />
          </Card>
        </>
      ) : (
        <Info>Nenhuma área desta prova tem nota ainda.</Info>
      )}
      <Tabela
        colunas={["Área", "Status", "Acertos", "Total", "%", "Erros"]}
        alinharDireita={[2, 3, 4]}
        linhas={lista.map((a) => [
          a.area,
          STATUS_LABEL[a.status as Status] ?? a.status,
          a.acertos,
          a.total,
          temNota(a) ? fmtPct(pct(a.acertos, a.total)) : "—",
          a.status === FIZ ? (a.estudada ? "📚 estudado" : "—") : "",
        ])}
      />
      {naoFiz.length > 0 && <p className="text-xs text-muted">⬜ Não fiz: {naoFiz.join(", ")}</p>}
    </div>
  );
}

/* ---------------- evolução de uma área ---------------- */

function EvolucaoPorArea({ provas, areas, meta }: { provas: Prova[]; areas: Area[]; meta: number }) {
  const [area, setArea] = useState<string>(AREAS[0]);
  const pontos = evolucaoDaArea(area, areas, provas);
  const tend = tendencia(pontos);
  const bancas = areaPorBanca(area, areas, provas);

  return (
    <Secao titulo="📈 Evolução por área (ao longo do tempo)">
      <Selecao
        rotulo="Área"
        valor={area}
        onChange={setArea}
        className="max-w-xs"
        opcoes={AREAS.map((a) => ({ valor: a, texto: a }))}
      />
      <div className="mt-4">
        {pontos.length === 0 ? (
          <Info>Nenhuma nota registrada em {area} ainda.</Info>
        ) : (
          <Card>
            <GraficoEvolucaoArea pontos={pontos} meta={meta} area={area} />
            <p className="mt-2 text-sm text-muted">
              {tend ?? "Registre essa área em mais provas para ver a tendência ao longo do tempo."}
            </p>
          </Card>
        )}
      </div>
      {bancas.length >= 2 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">{area}: comparação por banca</h3>
          <Card>
            <GraficoBancas dados={bancas} meta={meta} />
          </Card>
        </div>
      )}
    </Secao>
  );
}

/* ---------------- atualizar ---------------- */

function AtualizarProva({ provas, areas, meta }: { provas: Prova[]; areas: Area[]; meta: number }) {
  const [id, setId] = useState<number>(provas[0]!.id);
  const prova = provas.find((p) => p.id === id) ?? provas[0]!;
  const ap = areasDaProva(areas, prova.id);
  // a "chave" faz o formulário recomeçar com os dados certos ao trocar de prova ou depois de salvar
  const chave = `${prova.id}:${ap.map((a) => `${a.status}${a.acertos}/${a.total}${a.estudada}`).join("|")}`;

  return (
    <Recolhivel titulo="✏️ Atualizar prova (notas e estudo dos erros)">
      <p className="mb-3 text-sm text-muted">
        Preencha <b>acertos/total</b> das áreas que você fez (o % é calculado na hora). Marque <b>📚 estudei</b> quando já
        tiver estudado os erros daquela área.
      </p>
      <Selecao<number>
        rotulo="Prova"
        valor={prova.id}
        onChange={setId}
        className="mb-4 max-w-md"
        opcoes={provas.map((p) => ({ valor: p.id, texto: nomeProva(p) }))}
      />
      <EditorAreas key={chave} provaId={prova.id} inicial={linhasDe(ap)} meta={meta} />
    </Recolhivel>
  );
}

function EditorAreas({ provaId, inicial, meta }: { provaId: number; inicial: LinhaArea[]; meta: number }) {
  const [linhas, setLinhas] = useState(inicial);
  const [msg, setMsg] = useState<Msg>(null);
  const [salvando, start] = useTransition();

  const salvar = () => {
    const erro = conferir(linhas);
    if (erro) return setMsg({ tipo: "erro", texto: erro });
    start(async () => {
      const r = await atualizarProva(provaId, paraSalvar(linhas));
      setMsg(r.ok ? { tipo: "ok", texto: "Atualizado!" } : { tipo: "erro", texto: r.erro });
    });
  };

  return (
    <div>
      <FormAreas linhas={linhas} onChange={setLinhas} comEstudo meta={meta} />
      <div className="mt-4">
        <Botao onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "💾 Salvar"}
        </Botao>
      </div>
      <Mensagem msg={msg} />
    </div>
  );
}

/* ---------------- excluir ---------------- */

function ExcluirProva({ provas }: { provas: Prova[] }) {
  const [id, setId] = useState<number>(provas[0]!.id);
  const prova = provas.find((p) => p.id === id) ?? provas[0]!;
  const [msg, setMsg] = useState<Msg>(null);
  const [excluindo, start] = useTransition();

  const excluir = () => {
    if (!window.confirm(`Excluir a prova ${nomeProva(prova)}? Isso não pode ser desfeito.`)) return;
    start(async () => {
      const r = await excluirProva(prova.id);
      setMsg(r.ok ? { tipo: "ok", texto: "Prova excluída." } : { tipo: "erro", texto: r.erro });
    });
  };

  return (
    <Recolhivel titulo="🗑️ Excluir prova">
      <Selecao<number>
        rotulo="Prova para excluir"
        valor={prova.id}
        onChange={setId}
        className="max-w-md"
        opcoes={provas.map((p) => ({ valor: p.id, texto: nomeProva(p) }))}
      />
      <div className="mt-4">
        <Botao tipo="perigo" onClick={excluir} disabled={excluindo}>
          {excluindo ? "Excluindo…" : "Excluir"}
        </Botao>
      </div>
      <Mensagem msg={msg} />
    </Recolhivel>
  );
}

/* ---------------- adicionar ---------------- */

function hojeISO() {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function NovaProva({ provas, meta }: { provas: Prova[]; meta: number }) {
  const [banca, setBanca] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState(hojeISO);
  const [linhas, setLinhas] = useState(linhasVazias);
  const [msg, setMsg] = useState<Msg>(null);
  const [salvando, start] = useTransition();
  const bancas = [...new Set(provas.map((p) => p.banca))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banca.trim()) return setMsg({ tipo: "erro", texto: "Informe a banca." });
    const erro = conferir(linhas);
    if (erro) return setMsg({ tipo: "erro", texto: erro });
    start(async () => {
      const r = await adicionarProva({ banca: banca.trim(), ano: Number(ano), data, areas: paraSalvar(linhas) });
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Prova salva!" });
        setBanca("");
        setLinhas(linhasVazias());
      } else setMsg({ tipo: "erro", texto: r.erro });
    });
  };

  return (
    <Secao
      titulo="➕ Adicionar nova prova"
      sub={
        <>
          Para cada área marque <b>Fiz</b> (preencha acertos e total: o % sai na hora) ou <b>Não fiz</b>. O estudo dos
          erros você marca depois, em <i>Atualizar prova</i>.
        </>
      }
    >
      <Card>
        <form onSubmit={salvar}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Banca</span>
              <input
                list="bancas-existentes"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="USP-SP"
                className={classeCampo}
              />
              <datalist id="bancas-existentes">
                {bancas.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Ano</span>
              <input
                inputMode="numeric"
                value={ano}
                onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className={`${classeCampo} num`}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Data que fiz</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={classeCampo} />
            </label>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Desempenho por grande área</h3>
          <FormAreas linhas={linhas} onChange={setLinhas} comEstudo={false} meta={meta} />
          <div className="mt-4">
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar prova"}
            </Botao>
          </div>
          <Mensagem msg={msg} />
        </form>
      </Card>
    </Secao>
  );
}

