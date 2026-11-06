import "server-only";
import pg from "pg";
import { AREAS, FIZ, NAO_FIZ, type Area, type ErroReg, type Prova } from "@/lib/calc";

/**
 * Conexão com o mesmo banco Supabase do app antigo, pelo "pooler" (porta 6543), próprio para a Vercel.
 * Usa a biblioteca "pg", que faz uma pergunta por conexão de cada vez: a biblioteca anterior ("postgres")
 * mandava várias de uma vez na mesma conexão e o pooler do Supabase travava quando duas páginas abriam juntas.
 */
const g = globalThis as unknown as { __poolR1?: pg.Pool };

function pool(): pg.Pool {
  if (!g.__poolR1) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    g.__poolR1 = new pg.Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      query_timeout: 20_000,
    });
  }
  return g.__poolR1;
}

type Cliente = Pick<pg.PoolClient, "query">;

/** Faz uma consulta e devolve as linhas. */
export async function q(texto: string, params: unknown[] = [], cli: Cliente = pool()) {
  const r = await cli.query(texto, params);
  return Object.assign(r.rows as Record<string, unknown>[], { count: r.rowCount ?? 0 });
}

/** Tudo dentro de fn acontece junto, ou nada acontece. */
async function transacao<T>(fn: (cli: pg.PoolClient) => Promise<T>): Promise<T> {
  const cli = await pool().connect();
  try {
    await cli.query("BEGIN");
    const res = await fn(cli);
    await cli.query("COMMIT");
    return res;
  } catch (e) {
    await cli.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cli.release();
  }
}

export async function listarProvas(): Promise<Prova[]> {
  const rows = await q(`
    SELECT id, banca, ano, to_char(data_feita, 'YYYY-MM-DD') AS data_feita,
           total_questoes, acertos
    FROM prova ORDER BY data_feita DESC, id DESC`);
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
  const rows = await q(`
    SELECT id, prova_id, area, acertos, total, status, estudada FROM desempenho_area ORDER BY id`);
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
  const rows = await q(`SELECT valor FROM config WHERE chave = 'meta_percentual'`);
  const v = Number(rows[0]?.valor);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 70;
}

export async function salvarMetaDb(meta: number): Promise<void> {
  await q(`
    INSERT INTO config (chave, valor) VALUES ('meta_percentual', $1)
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`, [String(meta)]);
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
async function recalcular(tx: Cliente, provaId: number) {
  await q(`
    UPDATE prova SET
      total_questoes = COALESCE((SELECT SUM(total) FROM desempenho_area
                                 WHERE prova_id = $1 AND status = 'feita'), 0),
      acertos        = COALESCE((SELECT SUM(acertos) FROM desempenho_area
                                 WHERE prova_id = $2 AND status = 'feita'), 0)
    WHERE id = $3`, [provaId, provaId, provaId], tx);
}

export async function inserirProvaDb(banca: string, ano: number, data: string, areas: AreaEntrada[]) {
  return transacao(async (tx) => {
    const [r] = await q(`
      INSERT INTO prova (banca, ano, data_feita, total_questoes, acertos)
      VALUES ($1, $2, $3, 0, 0) RETURNING id`, [banca, ano, data], tx);
    const id = Number(r!.id);
    for (const a of areas) {
      await q(`
        INSERT INTO desempenho_area (prova_id, area, status, acertos, total, estudada)
        VALUES ($1, $2, $3, $4, $5, $6)`, [id, a.area, a.status, a.acertos, a.total, a.estudada], tx);
    }
    await recalcular(tx, id);
    return id;
  });
}

export async function atualizarAreasDb(provaId: number, areas: AreaEntrada[]) {
  await transacao(async (tx) => {
    for (const a of areas) {
      const res = await q(`
        UPDATE desempenho_area SET status = $1, acertos = $2,
               total = $3, estudada = $4
        WHERE prova_id = $5 AND area = $6`, [a.status, a.acertos, a.total, a.estudada, provaId, a.area], tx);
      if (res.count === 0) {
        await q(`
          INSERT INTO desempenho_area (prova_id, area, status, acertos, total, estudada)
          VALUES ($1, $2, $3, $4, $5, $6)`, [provaId, a.area, a.status, a.acertos, a.total, a.estudada], tx);
      }
    }
    await recalcular(tx, provaId);
  });
}

export async function excluirProvaDb(provaId: number) {
  await q(`DELETE FROM prova WHERE id = $1`, [provaId]);
}

/** Data da prova-alvo (USP-SP), guardada na tabela config. "" quando não definida. */
export async function lerDataProva(): Promise<string | null> {
  const rows = await q(`SELECT valor FROM config WHERE chave = 'data_prova_foco'`);
  const v = String(rows[0]?.valor ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function salvarDataProvaDb(data: string): Promise<void> {
  await q(`
    INSERT INTO config (chave, valor) VALUES ('data_prova_foco', $1)
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`, [data]);
}

/** Metas e questões por área para a prova-alvo (JSON na tabela config), ou null se nunca salvo. */
export async function lerPlanoFoco(): Promise<unknown> {
  const rows = await q(`SELECT valor FROM config WHERE chave = 'plano_foco'`);
  try {
    return rows[0]?.valor ? JSON.parse(String(rows[0].valor)) : null;
  } catch {
    return null;
  }
}

export async function salvarPlanoFocoDb(json: string): Promise<void> {
  await q(`
    INSERT INTO config (chave, valor) VALUES ('plano_foco', $1)
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`, [json]);
}

/* ---------------- caderno de erros (tabela "erro", que já existia no banco) ---------------- */

export async function listarErros(): Promise<ErroReg[]> {
  const rows = await q(`
    SELECT id, prova_id, numero_questao, area, tema, tipo_erro, conceito, card_feito
    FROM erro ORDER BY id DESC`);
  return rows.map((r) => ({
    id: Number(r.id),
    prova_id: r.prova_id === null ? null : Number(r.prova_id),
    area: String(r.area ?? ""),
    tema: String(r.tema ?? ""),
    motivo: String(r.tipo_erro ?? ""),
    anotacao: String(r.conceito ?? ""),
    numero: r.numero_questao === null ? null : Number(r.numero_questao),
    card: Boolean(r.card_feito),
  }));
}

export interface ErroEntrada {
  prova_id: number | null;
  area: string;
  tema: string;
  motivo: string;
  anotacao: string;
  numero: number | null;
}

export async function inserirErroDb(e: ErroEntrada): Promise<void> {
  await q(`
    INSERT INTO erro (prova_id, numero_questao, area, tema, tipo_erro, conceito, card_feito)
    VALUES ($1, $2, $3, $4, $5, $6, false)`, [e.prova_id, e.numero, e.area, e.tema, e.motivo, e.anotacao]);
}

export async function excluirErroDb(id: number): Promise<void> {
  await q(`DELETE FROM erro WHERE id = $1`, [id]);
}

export async function marcarCardDb(id: number, card: boolean): Promise<void> {
  await q(`UPDATE erro SET card_feito = $1 WHERE id = $2`, [card, id]);
}
