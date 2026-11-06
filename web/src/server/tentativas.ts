import { q } from "./db";

/**
 * Limite de senhas erradas: 5 tentativas a cada 15 minutos por endereço.
 * Guarda a contagem numa tabela pequena do próprio banco. Se o banco falhar, não trava o login.
 */
const LIMITE = 5;
const JANELA_MIN = 15;

let tabelaPronta = false;
async function preparar() {
  if (tabelaPronta) return;
  await q(`
    CREATE TABLE IF NOT EXISTS login_falha (
      ip  TEXT PRIMARY KEY,
      n   INTEGER NOT NULL DEFAULT 0,
      ate TIMESTAMPTZ NOT NULL
    )`);
  tabelaPronta = true;
}

export async function bloqueado(ip: string): Promise<boolean> {
  try {
    await preparar();
    const r = await q(`SELECT n FROM login_falha WHERE ip = $1 AND ate > now()`, [ip]);
    return Number(r[0]?.n ?? 0) >= LIMITE;
  } catch {
    return false;
  }
}

export async function registrarFalha(ip: string): Promise<void> {
  try {
    await preparar();
    await q(
      `INSERT INTO login_falha (ip, n, ate) VALUES ($1, 1, now() + make_interval(mins => $2))
       ON CONFLICT (ip) DO UPDATE SET
         n   = CASE WHEN login_falha.ate > now() THEN login_falha.n + 1 ELSE 1 END,
         ate = CASE WHEN login_falha.ate > now() THEN login_falha.ate
                    ELSE now() + make_interval(mins => $2) END`,
      [ip, JANELA_MIN],
    );
  } catch {
    /* não trava o login */
  }
}

export async function limparFalhas(ip: string): Promise<void> {
  try {
    await q(`DELETE FROM login_falha WHERE ip = $1`, [ip]);
  } catch {
    /* sem problema */
  }
}
