"""Popula o banco com dados de exemplo. Roda automaticamente se o banco estiver vazio."""
import db


def seed():
    provas = db.listar_provas()
    if provas:
        return  # já tem dados

    db.init_db()

    # Prova 1 — USP-SP 2022
    p1 = db.inserir_prova("USP-SP", 2022, "2025-02-10", 120, 78)
    for area, ac, tot in [
        ("Clínica Médica", 22, 36),
        ("Cirurgia",        16, 24),
        ("Pediatria",       14, 24),
        ("GO",              10, 18),
        ("Preventiva",      16, 18),
    ]:
        db.inserir_desempenho_area(p1, area, ac, tot)

    for q, area, tema, tipo, conceito, resposta, prio in [
        (12, "Clínica Médica", "ICC", "conhecimento",
         "Critérios de Framingham para ICC",
         "Maiores: dispneia paroxística, ortopneia, turgência jugular, crepitações, B3. "
         "Menores: edema, tosse noturna, hepatomegalia. Diagnóstico: 2 maiores ou 1 maior + 2 menores.",
         3),
        (45, "Cirurgia", "Abdome agudo", "interpretação",
         "Sinal de Blumberg vs Rovsing no diagnóstico de apendicite",
         "Blumberg = dor à descompressão no ponto de McBurney (local). "
         "Rovsing = dor no QID ao palpar QIE (irradiado — sugere irritação peritoneal).",
         2),
        (88, "Preventiva", "Epidemiologia", "desatenção",
         "Diferença entre sensibilidade e especificidade",
         "Sensibilidade = VP/(VP+FN) — rastrear (não perder doentes). "
         "Especificidade = VN/(VN+FP) — confirmar (não rotular sadios).",
         2),
    ]:
        db.inserir_erro(p1, q, area, tema, tipo, conceito, resposta, prio)

    # Prova 2 — USP-SP 2023
    p2 = db.inserir_prova("USP-SP", 2023, "2025-03-15", 120, 85)
    for area, ac, tot in [
        ("Clínica Médica", 26, 36),
        ("Cirurgia",        19, 24),
        ("Pediatria",       16, 24),
        ("GO",              12, 18),
        ("Preventiva",      12, 18),
    ]:
        db.inserir_desempenho_area(p2, area, ac, tot)

    for q, area, tema, tipo, conceito, resposta, prio in [
        (7, "Preventiva", "Bioestatística", "interpretação",
         "Número Necessário para Tratar (NNT)",
         "NNT = 1/Redução Absoluta do Risco. Quanto MENOR, mais eficaz o tratamento. "
         "NNH (harm) segue o mesmo cálculo para eventos adversos.",
         3),
        (101, "Clínica Médica", "Diabetes", "desatenção",
         "Critérios diagnósticos de DM2",
         "Glicemia jejum ≥ 126; casual ≥ 200 + sintomas; HbA1c ≥ 6,5%; TOTG 2h ≥ 200. "
         "Pré-DM: jejum 100-125 ou TOTG 140-199 ou HbA1c 5,7-6,4%.",
         2),
    ]:
        db.inserir_erro(p2, q, area, tema, tipo, conceito, resposta, prio)

    # Prova 3 — UNICAMP 2023
    p3 = db.inserir_prova("UNICAMP", 2023, "2025-04-20", 100, 62)
    for area, ac, tot in [
        ("Clínica Médica", 18, 30),
        ("Cirurgia",        14, 20),
        ("Pediatria",       12, 20),
        ("GO",               9, 15),
        ("Preventiva",       9, 15),
    ]:
        db.inserir_desempenho_area(p3, area, ac, tot)

    for q, area, tema, tipo, conceito, resposta, prio in [
        (33, "Cirurgia", "Trauma", "conhecimento",
         "Classificação de choque hemorrágico (ATLS)",
         "I: <750 ml / <15%. II: 750-1500 / 15-30%. III: 1500-2000 / 30-40%. IV: >2000 / >40%. "
         "Classe III já com hipotensão, taquicardia e alteração de consciência.",
         3),
        (68, "GO", "Pré-eclâmpsia", "pegadinha",
         "Critério de gravidade da pré-eclâmpsia: quando a PA não define?",
         "Pré-eclâmpsia grave pode ocorrer com PA <160x110 se houver: proteinúria maciça, "
         "trombocitopenia <100k, Cr >1,1, ALT/AST >2x, edema pulmonar, sintomas neurológicos.",
         3),
        (82, "Pediatria", "Imunizações", "desatenção",
         "Calendário vacinal — quando dar a 3ª dose da pentavalente?",
         "6 meses. Esquema: 2, 4, 6 meses + reforço com DTP aos 15 meses e 4 anos.",
         1),
    ]:
        db.inserir_erro(p3, q, area, tema, tipo, conceito, resposta, prio)

    print("Banco populado com dados de exemplo.")


if __name__ == "__main__":
    db.init_db()
    seed()
    print("Feito.")
