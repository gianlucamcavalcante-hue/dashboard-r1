"use server";

import { revalidatePath } from "next/cache";
import { AREAS, MOTIVOS, validarPlano, type PlanoFoco } from "@/lib/calc";
import { exigirSessao } from "./sessao";
import {
  atualizarAreasDb,
  excluirProvaDb,
  inserirProvaDb,
  salvarMetaDb,
  salvarDataProvaDb,
  salvarPlanoFocoDb,
  inserirErroDb,
  excluirErroDb,
  marcarCardDb,
  validarAreas,
  type AreaEntrada,
} from "./db";

export type Resultado = { ok: true } | { ok: false; erro: string };

function limpar(areas: AreaEntrada[]): AreaEntrada[] {
  return (areas ?? []).map((a) => ({
    area: String(a.area),
    status: String(a.status),
    acertos: Number(a.acertos),
    total: Number(a.total),
    estudada: Boolean(a.estudada),
  }));
}

async function executar(fn: () => Promise<unknown>): Promise<Resultado> {
  try {
    await exigirSessao();
    await fn();
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error && e.message.includes("sessão") ? e.message : "Não deu para salvar. Tente de novo.";
    return { ok: false, erro: msg };
  }
}

export async function salvarMeta(meta: number): Promise<Resultado> {
  const m = Math.round(Number(meta));
  if (!Number.isFinite(m) || m < 50 || m > 100) return { ok: false, erro: "A meta vai de 50% a 100%." };
  return executar(() => salvarMetaDb(m));
}

export async function adicionarProva(dados: {
  banca: string;
  ano: number;
  data: string;
  areas: AreaEntrada[];
}): Promise<Resultado> {
  const banca = String(dados.banca ?? "").trim();
  const ano = Math.round(Number(dados.ano));
  const data = String(dados.data ?? "");
  const areas = limpar(dados.areas);
  if (!banca) return { ok: false, erro: "Informe a banca." };
  if (banca.length > 80) return { ok: false, erro: "Nome da banca muito longo." };
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { ok: false, erro: "Ano inválido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: "Informe a data em que fez a prova." };
  const erro = validarAreas(areas);
  if (erro) return { ok: false, erro };
  return executar(() => inserirProvaDb(banca, ano, data, areas));
}

export async function atualizarProva(provaId: number, areas: AreaEntrada[]): Promise<Resultado> {
  const id = Number(provaId);
  if (!Number.isInteger(id)) return { ok: false, erro: "Prova inválida." };
  const lista = limpar(areas);
  const erro = validarAreas(lista);
  if (erro) return { ok: false, erro };
  return executar(() => atualizarAreasDb(id, lista));
}

export async function excluirProva(provaId: number): Promise<Resultado> {
  const id = Number(provaId);
  if (!Number.isInteger(id)) return { ok: false, erro: "Prova inválida." };
  return executar(() => excluirProvaDb(id));
}

/** Data da prova-alvo (AAAA-MM-DD) ou "" para apagar. */
export async function salvarDataProva(data: string): Promise<Resultado> {
  const d = String(data ?? "");
  if (d !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, erro: "Data inválida." };
  return executar(() => salvarDataProvaDb(d));
}

/** Metas (%) e questões por área da prova-alvo. */
export async function salvarPlanoFoco(plano: PlanoFoco): Promise<Resultado> {
  const limpo: PlanoFoco = { metas: {}, questoes: {} };
  for (const a of AREAS) {
    limpo.metas[a] = Number(plano?.metas?.[a]);
    limpo.questoes[a] = Number(plano?.questoes?.[a]);
  }
  const erro = validarPlano(limpo);
  if (erro) return { ok: false, erro };
  return executar(() => salvarPlanoFocoDb(JSON.stringify(limpo)));
}

/* ---------------- caderno de erros ---------------- */

export async function adicionarErro(dados: {
  prova_id: number | null;
  area: string;
  tema: string;
  motivo: string;
  anotacao: string;
  numero: number | null;
}): Promise<Resultado> {
  const area = String(dados.area ?? "");
  const tema = String(dados.tema ?? "").trim().replace(/\s+/g, " ");
  const motivo = String(dados.motivo ?? "");
  const anotacao = String(dados.anotacao ?? "").trim();
  const prova = dados.prova_id === null || dados.prova_id === undefined ? null : Number(dados.prova_id);
  const numero = dados.numero === null || dados.numero === undefined ? null : Number(dados.numero);
  if (!(AREAS as readonly string[]).includes(area)) return { ok: false, erro: "Escolha a área." };
  if (!tema) return { ok: false, erro: "Escreva o tema da questão (ex.: pré-eclâmpsia)." };
  if (tema.length > 120) return { ok: false, erro: "Tema muito longo: resuma em poucas palavras." };
  if (!MOTIVOS.some((m) => m.id === motivo)) return { ok: false, erro: "Escolha o motivo do erro." };
  if (anotacao.length > 1000) return { ok: false, erro: "Anotação muito longa." };
  if (prova !== null && !Number.isInteger(prova)) return { ok: false, erro: "Prova inválida." };
  if (numero !== null && (!Number.isInteger(numero) || numero < 1 || numero > 300))
    return { ok: false, erro: "Número da questão inválido." };
  return executar(() => inserirErroDb({ prova_id: prova, area, tema, motivo, anotacao, numero }));
}

export async function excluirErro(id: number): Promise<Resultado> {
  const n = Number(id);
  if (!Number.isInteger(n)) return { ok: false, erro: "Registro inválido." };
  return executar(() => excluirErroDb(n));
}

export async function marcarCard(id: number, card: boolean): Promise<Resultado> {
  const n = Number(id);
  if (!Number.isInteger(n)) return { ok: false, erro: "Registro inválido." };
  return executar(() => marcarCardDb(n, Boolean(card)));
}
