import html
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from playwright.sync_api import sync_playwright

GRANULARITY_LABELS: Dict[str, str] = {
    "ANNUAL": "Anual",
    "SEMESTER": "Semestral",
    "TRIMESTER": "Trimestral",
    "BIMONTHLY": "Bimestral",
    "MONTHLY": "Mensal",
    "WEEKLY": "Semanal",
    "DAILY": "Diário",
    "CUSTOM": "Personalizado",
}

def format_date(date_str: Optional[str]) -> str:
    if not date_str:
        return ""
    try:
        clean = date_str.split("T")[0]
        dt = datetime.strptime(clean, "%Y-%m-%d")
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return str(date_str)

def format_date_range(start_at: Optional[str], end_at: Optional[str]) -> str:
    if start_at and end_at:
        s = format_date(start_at)
        e = format_date(end_at)
        return s if s == e else f"{s} a {e}"
    if start_at:
        return format_date(start_at)
    return ""

def format_block_unit(block: Dict[str, Any], index: int = 0, custom_unit_name: Optional[str] = None) -> str:
    num = index + 1
    if custom_unit_name and custom_unit_name.strip():
        clean_unit = custom_unit_name.split("/")[0].strip()
        return f"{clean_unit} {num}"

    gran = (block.get("granularity") or "").upper()
    if gran == "ANNUAL":
        return f"{num}º Ano"
    elif gran == "SEMESTER":
        return f"{num}º Semestre"
    elif gran == "TRIMESTER":
        return f"{num}º Trimestre"
    elif gran == "BIMONTHLY":
        return f"{num}º Bimestre"
    elif gran == "MONTHLY":
        start_at = block.get("startAt")
        if start_at:
            try:
                clean = start_at.split("T")[0]
                dt = datetime.strptime(clean, "%Y-%m-%d")
                meses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                         "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
                return f"Mês {num} ({meses[dt.month]})"
            except Exception:
                pass
        return f"Mês {num}"
    elif gran == "WEEKLY":
        return f"Semana {num}"
    elif gran == "DAILY":
        return f"Aula {num}"
    elif gran == "CUSTOM":
        return f"Unidade {num}"

    start_at = block.get("startAt")
    end_at = block.get("endAt")
    if start_at and end_at and start_at != end_at:
        try:
            d1 = datetime.strptime(start_at.split("T")[0], "%Y-%m-%d")
            d2 = datetime.strptime(end_at.split("T")[0], "%Y-%m-%d")
            diff_days = abs((d2 - d1).days)
            if diff_days >= 60:
                return f"{num}º Trimestre"
            if diff_days >= 45:
                return f"{num}º Bimestre"
            if diff_days >= 25:
                return f"Mês {num}"
            if diff_days >= 4:
                return f"Semana {num}"
        except Exception:
            pass

    return f"Aula {num}"

def resolve_order_column_header(blocks: List[Dict[str, Any]], order_spec: Optional[Dict[str, Any]]) -> str:
    if order_spec:
        if order_spec.get("customLabel"):
            return order_spec["customLabel"]
        col = (order_spec.get("colName") or "").lower()
        if col and col not in ["order", "aula", "aulas"]:
            return order_spec["colName"]

    gran_counts: Dict[str, int] = {}
    for b in blocks:
        g = (b.get("granularity") or "UNKNOWN").upper()
        gran_counts[g] = gran_counts.get(g, 0) + 1

    max_gran = max(gran_counts, key=gran_counts.get) if gran_counts else ""
    mapping = {
        "ANNUAL": "Ano / Período",
        "SEMESTER": "Semestre / Período",
        "TRIMESTER": "Trimestre / Período",
        "BIMONTHLY": "Bimestre / Período",
        "MONTHLY": "Mês / Período",
        "WEEKLY": "Semana / Período",
        "DAILY": "Aula / Data",
        "CUSTOM": "Unidade / Período",
    }
    if max_gran in mapping:
        return mapping[max_gran]

    has_ranges = any(b.get("startAt") and b.get("endAt") and b.get("startAt") != b.get("endAt") for b in blocks)
    return "Período / Data" if has_ranges else "Identificação / Data"

def build_html_template(
    planning: Dict[str, Any],
    specifications: List[Dict[str, Any]],
    orientation: str = "portrait"
) -> str:
    header_specs = [s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("isVisible") is not False]
    block_specs = [s for s in specifications if s.get("tableRef") == "PLANNING_BLOCK" and s.get("isVisible") is not False]
    header_metadata = planning.get("metadataValues") or []

    comp_names = [c.get("name") for c in planning.get("curricularComponents") or [] if c.get("name")]
    title_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["titulo", "title", "plano", "nome"]), None)
    title_meta = None
    if title_spec:
        title_meta = next((m for m in header_metadata if m.get("specificationId") == title_spec.get("id") or (m.get("specification") and m["specification"].get("colName") == title_spec.get("colName"))), None)

    doc_title = (
        title_meta.get("textValue")
        if title_meta and title_meta.get("textValue")
        else (title_spec.get("customLabel") if title_spec and title_spec.get("customLabel") else (
            f"Plano de Ensino — {', '.join(comp_names)}" if comp_names else "Plano de Ensino"
        ))
    )

    year_name = planning.get("applicationYear", {}).get("name") if planning.get("applicationYear") else None
    year_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["applicationyear", "ano", "etapa", "serie", "turma"]), None)
    show_year = bool(year_name) and (year_spec.get("isVisible") is not False if year_spec else True)

    school_name = planning.get("school", {}).get("name") if planning.get("school") else None
    school_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["school", "escola", "instituicao", "rede"]), None)
    show_school = bool(school_name) and (school_spec.get("isVisible") is not False if school_spec else True)

    period_str = format_date_range(planning.get("startAt"), planning.get("endAt"))
    period_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["periodo", "period", "datas", "cronograma"]), None)
    show_period = bool(period_str) and (period_spec.get("isVisible") is not False if period_spec else True)

    # Summary Grid
    grid_items: List[Tuple[str, str, int]] = []
    comp_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["curricularcomponents", "componente", "disciplina", "materia"]), None)
    if comp_names and (comp_spec.get("isVisible") is not False if comp_spec else True):
        lbl = comp_spec.get("customLabel") or comp_spec.get("colName") or "Componente" if comp_spec else "Componente"
        grid_items.append((lbl, ", ".join(comp_names), comp_spec.get("order", 0) if comp_spec else 0))

    if show_year and year_name:
        lbl = year_spec.get("customLabel") or year_spec.get("colName") or "Ano / Etapa" if year_spec else "Ano / Etapa"
        grid_items.append((lbl, year_name, year_spec.get("order", 1) if year_spec else 1))

    if show_school and school_name:
        lbl = school_spec.get("customLabel") or school_spec.get("colName") or "Escola" if school_spec else "Escola"
        grid_items.append((lbl, school_name, school_spec.get("order", 2) if school_spec else 2))

    if show_period and period_str:
        lbl = period_spec.get("customLabel") or period_spec.get("colName") or "Período" if period_spec else "Período"
        grid_items.append((lbl, period_str, period_spec.get("order", 3) if period_spec else 3))

    native_header_cols = [
        "titulo", "title", "plano", "nome", "curricularcomponents", "componente", "disciplina", "materia",
        "applicationyear", "ano", "etapa", "serie", "turma", "school", "escola", "instituicao", "rede",
        "startat", "endat", "periodo", "period", "datas", "cronograma", "learningobjectives",
        "habilidades_bncc", "bncc", "habilidades", "objetivos_aprendizagem", "evaluations", "avaliacao",
        "avaliacoes", "instrumento_avaliacao", "como_avaliar"
    ]

    long_dynamic_items: List[Tuple[str, str, int]] = []
    for spec in header_specs:
        col = (spec.get("colName") or "").lower()
        if col in native_header_cols:
            continue
        meta = next((m for m in header_metadata if m.get("specificationId") == spec.get("id") or (m.get("specification") and m["specification"].get("colName", "").lower() == col)), None)
        val = (meta.get("textValue") or "").strip() if meta else ""
        if val:
            lbl = spec.get("customLabel") or spec.get("colName") or "Item"
            if len(val) > 50 or "\n" in val:
                long_dynamic_items.append((lbl, val, spec.get("order", 12)))
            else:
                grid_items.append((lbl, val, spec.get("order", 4)))

    grid_items.sort(key=lambda x: x[2])

    grid_html = ""
    if grid_items:
        cards = "".join(f"""
            <div class="meta-card">
                <span class="meta-label">{html.escape(lbl)}</span>
                <span class="meta-value">{html.escape(val)}</span>
            </div>
        """ for lbl, val, _ in grid_items)
        grid_html = f'<div class="meta-grid">{cards}</div>'

    # Macro BNCC
    bncc_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["learningobjectives", "habilidades_bncc", "bncc", "habilidades", "objetivos_aprendizagem"]), None)
    show_bncc = (bncc_spec.get("isVisible") is not False if bncc_spec else True)
    macro_objs = planning.get("learningObjectives") or []
    bncc_html = ""
    if show_bncc and macro_objs:
        badges = "".join(f"""
            <span class="bncc-badge" title="{html.escape(obj.get('customDescription') or (obj.get('bnccSkill') or {}).get('description') or '')}">
                {html.escape((obj.get('bnccSkill') or {}).get('code') or 'BNCC')}
            </span>
        """ for obj in macro_objs)
        bncc_label = bncc_spec.get("customLabel") or bncc_spec.get("colName") or "Habilidades BNCC" if bncc_spec else "Habilidades BNCC"
        bncc_html = f"""
            <div class="macro-section">
                <div class="macro-title amber">✦ {html.escape(bncc_label.upper())}</div>
                <div class="badges-row">{badges}</div>
            </div>
        """

    # Macro Evaluations
    eval_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["evaluations", "avaliacao", "avaliacoes", "instrumento_avaliacao", "como_avaliar"]), None)
    show_eval = (eval_spec.get("isVisible") is not False if eval_spec else True)
    macro_evals = planning.get("evaluations") or []
    eval_html = ""
    if show_eval and macro_evals:
        eval_cards = "".join(f"""
            <div class="eval-card">
                <div class="eval-header">
                    <span class="eval-name">{html.escape(ev.get('name') or 'Instrumento Avaliativo')}</span>
                    {f'<span class="eval-type">{html.escape(ev["instrumentType"])}</span>' if ev.get("instrumentType") else ''}
                </div>
                {f'<p class="eval-desc">{html.escape(ev["description"])}</p>' if ev.get("description") else ''}
                {f'<div class="eval-crit">{html.escape(ev["criteria"])}</div>' if ev.get("criteria") else ''}
            </div>
        """ for ev in macro_evals)
        eval_label = eval_spec.get("customLabel") or eval_spec.get("colName") or "Avaliação da Aprendizagem" if eval_spec else "Avaliação da Aprendizagem"
        eval_html = f"""
            <div class="macro-section">
                <div class="macro-title emerald">✔ {html.escape(eval_label.upper())}</div>
                <div class="eval-grid">{eval_cards}</div>
            </div>
        """

    # Long dynamic sections
    long_html = "".join(f"""
        <div class="macro-section">
            <div class="macro-title">{html.escape(lbl.upper())}</div>
            <div class="long-text">{html.escape(val)}</div>
        </div>
    """ for lbl, val, _ in long_dynamic_items)

    # Blocks and tables
    blocks = planning.get("blocks") or []
    order_spec = next((s for s in block_specs if s.get("colName", "").lower() in ["order", "aula", "aulas", "data", "datas", "periodo", "semana", "bimestre", "identificacao"]), None)
    show_order = (order_spec.get("isVisible") is not False if order_spec else True)
    order_label = resolve_order_column_header(blocks, order_spec)

    metodologia_spec = next((s for s in block_specs if s.get("colName", "").lower() == "metodologia"), None)
    has_metodologia = any(bool((b.get("metodologia") or "").strip()) for b in blocks)
    show_metodologia = (metodologia_spec.get("isVisible") is not False if metodologia_spec else has_metodologia)
    metodologia_label = (metodologia_spec.get("customLabel") or metodologia_spec.get("colName") or "Sequência Didática") if metodologia_spec else "Sequência Didática"

    bncc_block_spec = next((s for s in block_specs if s.get("colName", "").lower() in ["learningobjectives", "habilidades_bncc", "bncc", "habilidades", "objetivos_aprendizagem"]), None)
    has_bncc_blocks = any(bool(b.get("learningObjectives")) for b in blocks)
    show_bncc_blocks = (bncc_block_spec.get("isVisible") is not False if bncc_block_spec else has_bncc_blocks)
    bncc_block_label = (bncc_block_spec.get("customLabel") or bncc_block_spec.get("colName") or "Habilidades BNCC") if bncc_block_spec else "Habilidades BNCC"

    eval_block_spec = next((s for s in block_specs if s.get("colName", "").lower() in ["evaluations", "avaliacao", "avaliacoes", "instrumento_avaliacao"]), None)
    has_eval_blocks = any(bool(b.get("evaluations")) for b in blocks)
    show_eval_blocks = (eval_block_spec.get("isVisible") is not False if eval_block_spec else has_eval_blocks)
    eval_block_label = (eval_block_spec.get("customLabel") or eval_block_spec.get("colName") or "Avaliação") if eval_block_spec else "Avaliação"

    native_block_cols = [
        "metodologia", "order", "startat", "endat", "evaluations", "avaliacao", "avaliacoes",
        "instrumento_avaliacao", "learningobjectives", "habilidades_bncc", "bncc", "habilidades",
        "objetivos_aprendizagem", "identificacao", "aula", "aulas", "data", "datas", "periodo", "semana", "bimestre"
    ]
    dynamic_block_specs = [s for s in block_specs if s.get("colName", "").lower() not in native_block_cols and s.get("isVisible") is not False]
    dynamic_block_specs.sort(key=lambda s: s.get("order", 4))

    active_cols = []
    if show_order:
        active_cols.append({"id": "order", "label": order_label, "order": order_spec.get("order", 0) if order_spec else 0, "width": "16%"})
    if show_metodologia:
        active_cols.append({"id": "metodologia", "label": metodologia_label, "order": metodologia_spec.get("order", 1) if metodologia_spec else 1, "width": "38%"})
    if show_bncc_blocks:
        active_cols.append({"id": "bncc", "label": bncc_block_label, "order": bncc_block_spec.get("order", 2) if bncc_block_spec else 2, "width": "18%"})
    if show_eval_blocks:
        active_cols.append({"id": "evaluations", "label": eval_block_label, "order": eval_block_spec.get("order", 3) if eval_block_spec else 3, "width": "18%"})
    for d_spec in dynamic_block_specs:
        active_cols.append({
            "id": f"spec_{d_spec.get('id')}",
            "spec": d_spec,
            "label": d_spec.get("customLabel") or d_spec.get("colName") or "Custom",
            "order": d_spec.get("order", 4),
            "width": "15%"
        })
    active_cols.sort(key=lambda c: c["order"])

    def render_table_html(target_blocks: List[Dict[str, Any]]) -> str:
        th_cells = "".join(f'<th style="width: {c["width"]};">{html.escape(c["label"].upper())}</th>' for c in active_cols)
        tr_rows = ""
        for idx, block in enumerate(target_blocks):
            td_cells = ""
            for col in active_cols:
                cid = col["id"]
                if cid == "order":
                    unit_label = format_block_unit(block, idx, order_spec.get("customLabel") if order_spec else None)
                    dt = format_date_range(block.get("startAt"), block.get("endAt"))
                    dt_html = f'<div class="block-date">{html.escape(dt)}</div>' if dt else '<div class="no-date">Sem data</div>'
                    td_cells += f'<td><div class="block-unit">{html.escape(unit_label)}</div>{dt_html}</td>'
                elif cid == "metodologia":
                    met = block.get("metodologia") or ""
                    met_content = f'<div class="met-text">{html.escape(met)}</div>' if met else '<span class="italic text-muted">Metodologia em elaboração...</span>'
                    td_cells += f'<td>{met_content}</td>'
                elif cid == "bncc":
                    objs = block.get("learningObjectives") or []
                    if objs:
                        b_html = "".join(f'<span class="badge-mini">{html.escape((o.get("bnccSkill") or {}).get("code") or "BNCC")}</span> ' for o in objs)
                        td_cells += f'<td><div class="badges-cell">{b_html}</div></td>'
                    else:
                        td_cells += '<td><span class="text-muted">—</span></td>'
                elif cid == "evaluations":
                    evals = block.get("evaluations") or []
                    if evals:
                        eval_items = []
                        for ev in evals:
                            ev_name = ev.get("name") or ev.get("instrumentType") or "Avaliação"
                            ev_crit = ev.get("criteria")
                            crit_part = f'<div class="eval-crit-mini">{html.escape(ev_crit)}</div>' if ev_crit else ""
                            eval_items.append(f'<div class="eval-mini-card"><strong>{html.escape(ev_name)}</strong>{crit_part}</div>')
                        td_cells += f'<td>{"".join(eval_items)}</td>'
                    else:
                        td_cells += '<td><span class="text-muted">—</span></td>'
                elif cid.startswith("spec_"):
                    spec = col["spec"]
                    s_id = spec.get("id")
                    s_col = (spec.get("colName") or "").lower()
                    meta_vals = block.get("metadataValues") or []
                    m_val = next((m for m in meta_vals if m.get("specificationId") == s_id or (m.get("specification") and m["specification"].get("colName", "").lower() == s_col)), None)
                    t_val = m_val.get("textValue") if m_val else None
                    if t_val:
                        td_cells += f'<td><div class="custom-val">{html.escape(t_val)}</div></td>'
                    else:
                        td_cells += '<td><span class="text-muted">—</span></td>'

            tr_rows += f'<tr>{td_cells}</tr>'

        return f"""
            <table class="planning-table">
                <thead><tr>{th_cells}</tr></thead>
                <tbody>{tr_rows}</tbody>
            </table>
        """

    has_children = any(b.get("parentId") for b in blocks)
    roots = [b for b in blocks if not b.get("parentId")]
    roots.sort(key=lambda b: (b.get("order", 0), b.get("startAt") or ""))

    body_sections_html = ""
    if has_children:
        for r_idx, root in enumerate(roots):
            child_blocks = [b for b in blocks if b.get("parentId") == root["id"]]
            child_blocks.sort(key=lambda b: (b.get("order", 0), b.get("startAt") or ""))
            sec_title = format_block_unit(root, r_idx, order_spec.get("customLabel") if order_spec else None)
            sec_date = format_date_range(root.get("startAt"), root.get("endAt"))
            date_badge = f'<span class="sec-date">{html.escape(sec_date)}</span>' if sec_date else ""
            parent_met = f'<p class="parent-met">{html.escape(root["metodologia"])}</p>' if root.get("metodologia") and show_metodologia else ""
            t_html = render_table_html(child_blocks if child_blocks else [root])

            body_sections_html += f"""
                <div class="section-container">
                    <div class="section-divider">
                        <div class="sec-left">
                            <span class="sec-symbol">§</span>
                            <span class="sec-title">{html.escape(sec_title.upper())}</span>
                        </div>
                        {date_badge}
                    </div>
                    {parent_met}
                    {t_html}
                </div>
            """
    else:
        body_sections_html = render_table_html(roots)

    # Complete Document HTML
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>{html.escape(doc_title)}</title>
    <style>
        @page {{
            size: A4 {orientation};
            margin: { '10mm 12mm' if orientation == 'portrait' else '8mm 10mm' };
        }}
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
        .header-container {{
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 12px;
        }}
        .title-row {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
            margin-bottom: 8px;
        }}
        .doc-title {{
            font-size: 15px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #020617;
        }}
        .doc-subtitle {{
            font-size: 11px;
            color: #475569;
            margin-top: 2px;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: { 'repeat(4, 1fr)' if orientation == 'landscape' else 'repeat(2, 1fr)' };
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px;
        }}
        .meta-card {{
            display: flex;
            flex-direction: column;
        }}
        .meta-label {{
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
        }}
        .meta-value {{
            font-size: 10.5px;
            font-weight: 600;
            color: #0f172a;
        }}
        .macro-section {{
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid #e2e8f0;
        }}
        .macro-title {{
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }}
        .macro-title.amber {{ color: #b45309; }}
        .macro-title.emerald {{ color: #047857; }}
        .badges-row {{
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }}
        .bncc-badge {{
            display: inline-block;
            background: #fef3c7;
            border: 1px solid #fcd34d;
            color: #78350f;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
            font-weight: 700;
            font-size: 9px;
        }}
        .eval-grid {{
            display: grid;
            grid-template-columns: { 'repeat(2, 1fr)' if orientation == 'landscape' else 'repeat(1, 1fr)' };
            gap: 6px;
        }}
        .eval-card {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 9.5px;
        }}
        .eval-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
        }}
        .eval-name {{ font-weight: 700; color: #020617; }}
        .eval-type {{
            background: #e2e8f0;
            border: 1px solid #cbd5e1;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 8.5px;
            font-family: monospace;
        }}
        .eval-desc {{ color: #475569; margin-bottom: 3px; }}
        .eval-crit {{
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 4px;
            border-radius: 3px;
            color: #334155;
            font-size: 9px;
        }}
        .section-container {{
            margin-bottom: 12px;
            page-break-inside: auto;
        }}
        .section-divider {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 3px;
            margin-bottom: 6px;
        }}
        .sec-left {{
            display: flex;
            align-items: center;
            gap: 5px;
        }}
        .sec-symbol {{
            background: #0f172a;
            color: #ffffff;
            font-weight: 800;
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
        }}
        .sec-title {{
            font-weight: 800;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #020617;
        }}
        .sec-date {{
            font-size: 10px;
            font-weight: 600;
            color: #475569;
        }}
        .parent-met {{
            font-style: italic;
            font-size: 10px;
            color: #475569;
            margin-bottom: 6px;
        }}
        .planning-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            border: 1px solid #cbd5e1;
            margin-bottom: 8px;
            page-break-inside: auto;
        }}
        .planning-table tr {{
            page-break-inside: avoid;
            page-break-after: auto;
        }}
        .planning-table th {{
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            font-weight: 700;
            font-size: 9px;
            text-align: left;
            color: #0f172a;
        }}
        .planning-table td {{
            border: 1px solid #e2e8f0;
            padding: 6px 8px;
            vertical-align: top;
        }}
        .block-unit {{
            font-weight: 700;
            color: #020617;
            font-size: 10px;
        }}
        .block-date {{
            font-size: 8.5px;
            color: #64748b;
            margin-top: 2px;
        }}
        .no-date {{
            font-size: 8.5px;
            color: #94a3b8;
            font-style: italic;
        }}
        .met-text {{
            white-space: pre-wrap;
            color: #0f172a;
            line-height: 1.4;
        }}
        .badge-mini {{
            display: inline-block;
            background: #fef3c7;
            border: 1px solid #fcd34d;
            color: #78350f;
            padding: 1px 4px;
            border-radius: 2px;
            font-family: monospace;
            font-size: 8.5px;
            font-weight: 700;
            margin-bottom: 2px;
        }}
        .eval-mini-card {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 4px;
            border-radius: 3px;
            margin-bottom: 3px;
            font-size: 9px;
        }}
        .eval-crit-mini {{
            color: #64748b;
            font-size: 8px;
            margin-top: 1px;
        }}
        .text-muted {{ color: #94a3b8; }}
        .italic {{ font-style: italic; }}
    </style>
</head>
<body>
    <div class="header-container">
        <div class="title-row">
            <div>
                <h1 class="doc-title">{html.escape(doc_title)}</h1>
                {f'<div class="doc-subtitle">{html.escape(year_name)}</div>' if show_year and year_name else ''}
            </div>
        </div>
        {grid_html}
        {bncc_html}
        {eval_html}
        {long_html}
    </div>

    {body_sections_html}
</body>
</html>
"""

def render_pdf(
    planning: Dict[str, Any],
    specifications: List[Dict[str, Any]],
    orientation: str = "portrait",
    html_content: Optional[str] = None
) -> Tuple[bytes, str]:
    full_html = html_content if html_content and html_content.strip() else build_html_template(planning, specifications, orientation)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
            ]
        )
        page = browser.new_page()
        page.set_content(full_html, wait_until="load")

        is_landscape = (orientation == "landscape")
        pdf_bytes = page.pdf(
            format="A4",
            landscape=is_landscape,
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
        )
        browser.close()

    comp_names = [c.get("name") for c in planning.get("curricularComponents") or [] if c.get("name")]
    comp_slug = comp_names[0].replace(" ", "_") if comp_names else "aula"
    filename = f"planejamento-{comp_slug}-{orientation}.pdf"
    return pdf_bytes, filename
