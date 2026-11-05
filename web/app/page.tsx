import { listarAreas, listarProvas, lerDataProva, lerMeta, lerPlanoFoco } from "@/server/db";
import { normalizarPlano } from "@/lib/calc";
import { senhaConfigurada } from "@/server/auth";
import Painel from "@/components/painel";

// Sempre lê o banco na hora (nada de página guardada).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [provas, areas, meta, dataProva, planoBruto] = await Promise.all([
    listarProvas(),
    listarAreas(),
    lerMeta(),
    lerDataProva(),
    lerPlanoFoco(),
  ]);
  const plano = normalizarPlano(planoBruto, meta);
  return (
    <Painel
      provas={provas}
      areas={areas}
      meta={meta}
      plano={plano}
      planoSalvo={planoBruto !== null}
      dataProva={dataProva}
      comSenha={senhaConfigurada()}
    />
  );
}
