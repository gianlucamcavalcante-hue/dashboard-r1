import "server-only";
import { cookies } from "next/headers";
import { painelBloqueado, senhaConfigurada, validarSessao } from "./auth";

/** Usado dentro das ações de escrita: garante que há sessão válida (quando há senha). */
export async function exigirSessao(): Promise<void> {
  if (painelBloqueado()) throw new Error("Painel sem senha configurada.");
  if (!senhaConfigurada()) return; // sem senha = uso local, liberado
  const token = cookies().get("sessao")?.value;
  if (!(await validarSessao(token))) {
    throw new Error("Sua sessão expirou. Entre de novo.");
  }
}
