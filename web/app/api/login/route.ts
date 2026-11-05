import { NextResponse } from "next/server";
import { senhaCorreta, criarSessao } from "../../../src/server/auth";
import { bloqueado, limparFalhas, registrarFalha } from "../../../src/server/tentativas";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (await bloqueado(ip)) {
    return NextResponse.redirect(new URL("/login?erro=limite", req.url), 303);
  }

  const form = await req.formData();
  const senha = String(form.get("senha") ?? "");

  if (!senhaCorreta(senha)) {
    await registrarFalha(ip);
    return NextResponse.redirect(new URL("/login?erro=1", req.url), 303);
  }

  await limparFalhas(ip);
  const token = await criarSessao();
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set("sessao", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    path: "/",
  });
  return res;
}
