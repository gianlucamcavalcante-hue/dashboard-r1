"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "./sessao";
import {
  atualizarAreasDb,
  excluirProvaDb,
  inserirProvaDb,
  salvarMetaDb,
  salvarDataProvaDb,
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
