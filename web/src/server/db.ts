import "server-only";
import postgres from "postgres";
import { AREAS, FIZ, NAO_FIZ, type Area, type Prova } from "@/lib/calc";

/**
 * Conexão com o mesmo banco Supabase do app antigo.
 * A URL usa o "pooler" do Supabase (porta 6543), próprio para a Vercel: por isso prepare=false.
 */
type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __sqlR1?: Sql };

export function sql(): Sql {
  if (!g.__sqlR1) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    g.__sqlR1 = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
  }
  return g.__sqlR1;
}

export async function listarProvas(): Promise<Prova[]> {
  const rows = await sql()`
    SELECT id, banca, ano, to_char(data_feita, 'YYYY-MM-DD') AS data_feita,
           total_questoes, acertos
    FROM prova ORDER BY data_feita DESC, id DESC`;
  return rows.map((r) => ({
    id: Number(r.id),
    banca: String(r.banca),
    ano: Number(r.ano),
    data_feita: r.data_feita ? String(r.data_feita) : null,
    total_questoes: Number(r.total_questoes),
    acertos: Number(r.acertos),
  }));
}

export async function listarAreas(): Promise<Area[]> {
  const rows = await sql()`
    SELECT id, prova_id, area, acertos, total, status, estudada FROM desempenho_area ORDER BY id`;
  return rows.map((r) => ({
    id: Number(r.id),
    prova_id: Number(r.prova_id),
    area: String(r.area),
    acertos: Number(r.acertos),
    total: Number(r.total),
    status: String(r.status ?? FIZ),
    estudada: Boolean(r.estudada),
  }));
}

export async function lerMeta(): Promise<number> {
  const rows = await sql()`SELECT valor FROM config WHERE chave = 'meta_percentual'`;
  const v = Number(rows[0]?.valor);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 70;
}

export async function salvarMetaDb(meta: number): Promise<void> {
  await sql()`
    INSERT INTO config (chave, valor) VALUES ('meta_percentual', ${String(meta)})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
}

export interface AreaEntrada {
  area: string;
  status: string;
  acertos: number;
  total: number;
  estudada: boolean;
}

/** Confere tudo antes de gravar. Devolve a mensagem de erro, ou null se estiver certo. */
export function validarAreas(areas: AreaEntrada[]): string | null {
  for (const a of areas) {
    if (!(AREAS as readonly string[]).includes(a.area)) return `Área desconhecida: ${a.area}`;
    if (a.status !== FIZ && a.status !== NAO_FIZ) return `${a.area}: escolha Fiz ou Não fiz.`;
    for (const n of [a.acertos, a.total]) {
      if (!Number.isInteger(n) || n < 0 || n > 1000) return `${a.area}: use números inteiros de 0 a 1000.`;
    }
    if (a.status === FIZ && a.acertos > a.total) return `${a.area}: acertos não pode ser maior que total.`;
  }
  return null;
}

/** Total e acertos da prova = soma das áreas que fiz (igual ao app antigo). */
async function recalcular(tx: Sql | postgres.TransactionSql, provaId: number) {
  await tx`
    UPDATE prova SET
      total_questoes = COALESCE((SELECT SUM(total) FROM desempenho_area
                                 WHERE prova_id = ${provaId} AND status = 'feita'), 0),
      acertos        = COALESCE((SELECT SUM(acertos) FROM desempenho_area
                                 WHERE prova_id = ${provaId} AND status = 'feita'), 0)
    WHERE id = ${provaId}`;
}

export async function inserirProvaDb(banca: string, ano: number, data: string, areas: AreaEntrada[]) {
  return sql().begin(async (tx) => {
    const [r] = await tx`
      INSERT INTO prova (banca, ano, data_feita, total_questoes, acertos)
      VALUES (${banca}, ${ano}, ${data}, 0, 0) RETURNING id`;
    const id = Number(r!.id);
    for (const a of areas) {
      await tx`
        INSERT INTO desempenho_area (prova_id, area, status, acertos, total, estudada)
        VALUES (${id}, ${a.area}, ${a.status}, ${a.acertos}, ${a.total}, ${a.estudada})`;
    }
    await recalcular(tx, id);
    return id;
  });
}

export async function atualizarAreasDb(provaId: number, areas: AreaEntrada[]) {
  await sql().begin(async (tx) => {
    for (const a of areas) {
      const res = await tx`
        UPDATE desempenho_area SET status = ${a.status}, acertos = ${a.acertos},
               total = ${a.total}, estudada = ${a.estudada}
        WHERE prova_id = ${provaId} AND area = ${a.area}`;
      if (res.count === 0) {
        await tx`
          INSERT INTO desempenho_area (prova_id, area, status, acertos, total, estudada)
          VALUES (${provaId}, ${a.area}, ${a.status}, ${a.acertos}, ${a.total}, ${a.estudada})`;
      }
    }
    await recalcular(tx, provaId);
  });
}

export async function excluirProvaDb(provaId: number) {
  await sql()`DELETE FROM prova WHERE id = ${provaId}`;
}

/** Data da prova-alvo (USP-SP), guardada na tabela config. "" quando não definida. */
export async function lerDataProva(): Promise<string | null> {
  const rows = await sql()`SELECT valor FROM config WHERE chave = 'data_prova_foco'`;
  const v = String(rows[0]?.valor ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function salvarDataProvaDb(data: string): Promise<void> {
  await sql()`
    INSERT INTO config (chave, valor) VALUES ('data_prova_foco', ${data})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
}

/** Metas e questões por área para a prova-alvo (JSON na tabela config), ou null se nunca salvo. */
export async function lerPlanoFoco(): Promise<unknown> {
  const rows = await sql()`SELECT valor FROM config WHERE chave = 'plano_foco'`;
  try {
    return rows[0]?.valor ? JSON.parse(String(rows[0].valor)) : null;
  } catch {
    return null;
  }
}

export async function salvarPlanoFocoDb(json: string): Promise<void> {
  await sql()`
    INSERT INTO config (chave, valor) VALUES ('plano_foco', ${json})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
}
