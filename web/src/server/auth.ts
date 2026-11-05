import { SignJWT, jwtVerify } from "jose";

/**
 * Login simples por senha. A senha vem de DASHBOARD_PASSWORD (definida na Vercel).
 * O login gera um cookie assinado (não guarda a senha), válido por 30 dias.
 * Sem DASHBOARD_PASSWORD, o painel fica aberto só no computador; na Vercel ele fecha.
 */
const alg = "HS256";

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || "troque-isto-em-producao";
  return new TextEncoder().encode(s.padEnd(32, "x"));
}

export async function criarSessao(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(segredo());
}

export async function validarSessao(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, segredo());
    return true;
  } catch {
    return false;
  }
}

/** Há senha configurada? Se não, o app fica aberto (modo local). */
export function senhaConfigurada(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

/** Em produção, faltar a senha é erro de configuração: o painel fecha em vez de abrir. */
export function painelBloqueado(): boolean {
  return !senhaConfigurada() && Boolean(process.env.VERCEL);
}

/** Compara byte a byte sem parar no primeiro erro, para o tempo não entregar a senha. */
export function senhaCorreta(tentativa: string): boolean {
  const esperada = process.env.DASHBOARD_PASSWORD;
  if (!esperada) return false;
  const a = new TextEncoder().encode(tentativa);
  const b = new TextEncoder().encode(esperada);
  let diferenca = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diferenca |= (a[i] ?? 0) ^ b[i]!;
  return diferenca === 0;
}
