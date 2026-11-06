"use client";

import { useMemo, useState, useTransition } from "react";
import { Botao, Card, Info, Mensagem, Secao, Selecao, classeCampo } from "./comum";
import { GraficoPareto } from "./graficos";
import { adicionarErro, excluirErro, marcarCard } from "@/server/acoes";
import {
  AREAS,
  MOTIVOS,
  MOTIVO_TEXTO,
  chaveTema,
  dataMs,
  nomeProva,
  pareto,
  type ErroReg,
  type Prova,
} from "@/lib/calc";

type Msg = { tipo: "ok" | "erro"; texto: string } | null;

/** Aba "Caderno de erros": registrar rápido, ver o que mais derruba (Pareto) e a lista. */
export default function CadernoErros({ provas, erros }: { provas: Prova[]; erros: ErroReg[] }) {
  const [filtroArea, setFiltroArea] = useState("todas");
  const doFiltro = erros.filter((e) => filtroArea === "todas" || e.area === filtroArea);
  const motivos = pareto(
    doFiltro.map((e) => e.motivo),
    (k) => MOTIVO_TEXTO[k] ?? k,
  );
  const temas = useMemo(() => {
    const nomes = new Map<string, string>();
    for (const e of doFiltro) if (!nomes.has(chaveTema(e.tema))) nomes.set(chaveTema(e.tema), e.tema.trim());
    return pareto(
      doFiltro.map((e) => chaveTema(e.tema)),
      (k) => nomes.get(k) ?? k,
    ).slice(0, 10);
  }, [doFiltro]);
  const top = motivos[0];
  const dica = top ? MOTIVOS.find((m) => m.id === top.chave)?.dica : undefined;

  return (
    <div>
      <p className="text-sm text-muted">
        Registre cada questão que errou: leva 10 segundos. Com o tempo, o painel mostra <b>por que</b> você erra e{" "}
        <b>quais temas</b> mais te derrubam, para você atacar exatamente isso.
      </p>

      <NovoErro provas={provas} temasExistentes={[...new Set(erros.map((e) => e.tema.trim()))]} />

      {erros.length === 0 ? (
        <div className="mt-6">
          <Info>
            Nenhum erro registrado ainda. Comece pela sua prova mais recente: cada erro lançado deixa o diagnóstico mais
            preciso.
          </Info>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">📊 O que mais te faz errar</h2>
            <Selecao
              valor={filtroArea}
              onChange={setFiltroArea}
              className="w-56"
              opcoes={[{ valor: "todas", texto: "Todas as áreas" }, ...AREAS.map((a) => ({ valor: a, texto: a }))]}
            />
          </div>
          {top && (
            <div className="mt-3 rounded-xl border-l-4 border-accent bg-accent/5 px-4 py-3 text-sm">
              Seu motivo nº 1 é <b>{top.texto}</b> ({top.pct.toLocaleString("pt-BR")}% dos erros
              {filtroArea !== "todas" ? ` em ${filtroArea}` : ""}).
              {dica && <> Dica: {dica}.</>}
            </div>
          )}
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-2 text-sm font-semibold">Motivos do erro</h3>
              {motivos.length ? <GraficoPareto dados={motivos} /> : <p className="text-sm text-muted">Sem dados.</p>}
            </Card>
            <Card>
              <h3 className="mb-2 text-sm font-semibold">Temas que mais aparecem nos seus erros</h3>
              {temas.length ? <GraficoPareto dados={temas} /> : <p className="text-sm text-muted">Sem dados.</p>}
            </Card>
          </div>

          <ListaErros provas={provas} erros={doFiltro} />
        </>
      )}
    </div>
  );
}

/* ---------------- formulário rápido ---------------- */

function NovoErro({ provas, temasExistentes }: { provas: Prova[]; temasExistentes: string[] }) {
  const ordenadas = [...provas].sort((a, b) => dataMs(b.data_feita) - dataMs(a.data_feita) || b.id - a.id);
  const [provaId, setProvaId] = useState<number>(ordenadas[0]?.id ?? 0);
  const [area, setArea] = useState<string>("");
  const [tema, setTema] = useState("");
  const [motivo, setMotivo] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [salvando, start] = useTransition();

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!area) return setMsg({ tipo: "erro", texto: "Escolha a área." });
    if (!tema.trim()) return setMsg({ tipo: "erro", texto: "Escreva o tema (ex.: pré-eclâmpsia)." });
    if (!motivo) return setMsg({ tipo: "erro", texto: "Escolha o motivo do erro." });
    start(async () => {
      const r = await adicionarErro({
        prova_id: provaId || null,
        area,
        tema,
        motivo,
        anotacao,
        numero: numero ? Number(numero) : null,
      });
      if (r.ok) {
        // mantém prova e área para lançar o próximo erro mais rápido
        setTema("");
        setMotivo("");
        setNumero("");
        setAnotacao("");
        setMsg({ tipo: "ok", texto: "Erro registrado. Pode lançar o próximo." });
      } else setMsg({ tipo: "erro", texto: r.erro });
    });
  };

  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition ${
      ativo ? "border-accent bg-accent text-white" : "border-border bg-card hover:bg-card2"
    }`;

  return (
    <Secao titulo="➕ Registrar erro">
      <Card>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Selecao<number>
              rotulo="Prova"
              valor={provaId}
              onChange={setProvaId}
              opcoes={[...ordenadas.map((p) => ({ valor: p.id, texto: nomeProva(p) })), { valor: 0, texto: "Outra (questão avulsa)" }]}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Nº da questão</span>
              <input
                inputMode="numeric"
                placeholder="opcional"
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className={`${classeCampo} num`}
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Área</span>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <button type="button" key={a} onClick={() => setArea(a)} className={chip(area === a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Tema</span>
            <input
              list="temas-existentes"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="ex.: pré-eclâmpsia, ITU na criança, apendicite"
              className={classeCampo}
            />
            <datalist id="temas-existentes">
              {temasExistentes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Por que errou?</span>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS.map((m) => (
                <button type="button" key={m.id} onClick={() => setMotivo(m.id)} className={chip(motivo === m.id)}>
                  {m.texto}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">O que lembrar (opcional)</span>
            <textarea
              value={anotacao}
              onChange={(e) => setAnotacao(e.target.value)}
              rows={2}
              placeholder="ex.: sulfato de magnésio se PA ≥ 160x110 com sinais de gravidade"
              className={classeCampo}
            />
          </label>

          <div className="flex items-center gap-3">
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Registrar erro"}
            </Botao>
            <Mensagem msg={msg} />
          </div>
        </form>
      </Card>
    </Secao>
  );
}

/* ---------------- lista ---------------- */

function ListaErros({ provas, erros }: { provas: Prova[]; erros: ErroReg[] }) {
  const [, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const nome = new Map(provas.map((p) => [p.id, `${p.banca} ${p.ano}`]));

  const alternar = (e: ErroReg) =>
    start(async () => {
      const r = await marcarCard(e.id, !e.card);
      setAviso(r.ok ? null : r.erro);
    });
  const apagar = (e: ErroReg) => {
    if (!window.confirm(`Apagar o erro "${e.tema}"?`)) return;
    start(async () => {
      const r = await excluirErro(e.id);
      setAviso(r.ok ? null : r.erro);
    });
  };

  return (
    <Secao titulo={`📝 Seus erros (${erros.length})`} sub="Marque “virou card” quando passar o erro para o Anki.">
      {aviso && <p className="mb-2 text-sm text-neg">{aviso}</p>}
      <div className="space-y-2">
        {erros.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{e.tema}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {e.area} · {MOTIVO_TEXTO[e.motivo] ?? e.motivo}
                  {e.prova_id !== null && nome.get(e.prova_id) && <> · {nome.get(e.prova_id)}</>}
                  {e.numero !== null && <> · questão {e.numero}</>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={e.card}
                    onChange={() => alternar(e)}
                    className="h-4 w-4 accent-[#3a6aa5]"
                  />
                  virou card
                </label>
                <button onClick={() => apagar(e)} className="text-xs text-muted hover:text-neg" aria-label="Apagar erro">
                  apagar
                </button>
              </div>
            </div>
            {e.anotacao && <p className="mt-2 text-sm leading-relaxed">{e.anotacao}</p>}
          </div>
        ))}
      </div>
    </Secao>
  );
}
