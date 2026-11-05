import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { painelBloqueado, validarSessao } from "./src/server/auth";

/** Bloqueia o acesso sem login quando há senha configurada (DASHBOARD_PASSWORD). */
export async function middleware(req: NextRequest) {
  if (painelBloqueado()) return new NextResponse("Configure DASHBOARD_PASSWORD na Vercel.", { status: 503 });
  // Sem senha configurada, o painel fica aberto (uso local no computador).
  if (!process.env.DASHBOARD_PASSWORD) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("sessao")?.value;
  if (await validarSessao(token)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
