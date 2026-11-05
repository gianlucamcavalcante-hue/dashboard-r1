import { listarAreas, listarProvas, lerMeta } from "@/server/db";
import { senhaConfigurada } from "@/server/auth";
import Painel from "@/components/painel";

// Sempre lê o banco na hora (nada de página guardada).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [provas, areas, meta] = await Promise.all([listarProvas(), listarAreas(), lerMeta()]);
  return <Painel provas={provas} areas={areas} meta={meta} comSenha={senhaConfigurada()} />;
}
