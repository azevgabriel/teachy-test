import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import docx
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Cm, Inches, Pt, RGBColor

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

def format_granularity(granularity: Optional[str]) -> str:
    if not granularity:
        return ""
    return GRANULARITY_LABELS.get(granularity.upper(), granularity)

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

def set_cell_background(cell, hex_color: str):
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="D1D5DB", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders_xml = f'''
    <w:tblBorders {nsdecls("w")}>
        <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:left w:val="none"/>
        <w:right w:val="none"/>
        <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
    </w:tblBorders>
    '''
    tblPr.append(parse_xml(borders_xml))

def render_docx(
    planning: Dict[str, Any],
    specifications: List[Dict[str, Any]],
    orientation: str = "portrait"
) -> Tuple[bytes, str]:
    doc = docx.Document()

    # 1. Page Orientation and Margins
    section = doc.sections[0]
    if orientation == "landscape":
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width = Cm(29.7)
        section.page_height = Cm(21.0)
    else:
        section.orientation = WD_ORIENT.PORTRAIT
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)

    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)

    # Styles setup
    style_normal = doc.styles['Normal']
    font = style_normal.font
    font.name = 'Calibri'
    font.size = Pt(10)
    font.color.rgb = RGBColor(15, 23, 42) # Slate-900

    # Running header & footer
    footer = section.footer
    f_p = footer.paragraphs[0]
    f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    f_run = f_p.add_run("Plano Curricular Estruturado • Teachy")
    f_run.font.size = Pt(8.5)
    f_run.font.color.rgb = RGBColor(148, 163, 184)

    # 2. Document Title and Metadata Specs
    header_specs = [s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("isVisible") is not False]
    block_specs = [s for s in specifications if s.get("tableRef") == "PLANNING_BLOCK" and s.get("isVisible") is not False]
    header_metadata = planning.get("metadataValues") or []

    # Title detection
    title_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["titulo", "title", "plano", "nome"]), None)
    title_meta = None
    if title_spec:
        title_meta = next((m for m in header_metadata if m.get("specificationId") == title_spec.get("id") or (m.get("specification") and m["specification"].get("colName") == title_spec.get("colName"))), None)

    comp_names = [c.get("name") for c in planning.get("curricularComponents") or [] if c.get("name")]
    doc_title = (
        title_meta.get("textValue")
        if title_meta and title_meta.get("textValue")
        else (title_spec.get("customLabel") if title_spec and title_spec.get("customLabel") else (
            f"Plano de Ensino — {', '.join(comp_names)}" if comp_names else "Plano de Ensino"
        ))
    )

    # Title Paragraph
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run(doc_title.upper())
    r_title.bold = True
    r_title.font.size = Pt(15)
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    year_name = planning.get("applicationYear", {}).get("name") if planning.get("applicationYear") else None
    year_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["applicationyear", "ano", "etapa", "serie", "turma"]), None)
    show_year = bool(year_name) and (year_spec.get("isVisible") is not False if year_spec else True)

    if show_year and year_name:
        p_sub = doc.add_paragraph()
        p_sub.paragraph_format.space_before = Pt(0)
        p_sub.paragraph_format.space_after = Pt(6)
        r_sub = p_sub.add_run(year_name)
        r_sub.font.size = Pt(11)
        r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # 3. Header Metadata Grid (Summary Table)
    grid_items: List[Tuple[str, str, int]] = []

    comp_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["curricularcomponents", "componente", "disciplina", "materia"]), None)
    if comp_names and (comp_spec.get("isVisible") is not False if comp_spec else True):
        label = (comp_spec.get("customLabel") or comp_spec.get("colName") or "Componente") if comp_spec else "Componente"
        grid_items.append((label, ", ".join(comp_names), comp_spec.get("order", 0) if comp_spec else 0))

    if show_year and year_name:
        label = (year_spec.get("customLabel") or year_spec.get("colName") or "Ano / Etapa") if year_spec else "Ano / Etapa"
        grid_items.append((label, year_name, year_spec.get("order", 1) if year_spec else 1))

    school_name = planning.get("school", {}).get("name") if planning.get("school") else None
    school_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["school", "escola", "instituicao", "rede"]), None)
    if school_name and (school_spec.get("isVisible") is not False if school_spec else True):
        label = (school_spec.get("customLabel") or school_spec.get("colName") or "Escola") if school_spec else "Escola"
        grid_items.append((label, school_name, school_spec.get("order", 2) if school_spec else 2))

    period_str = format_date_range(planning.get("startAt"), planning.get("endAt"))
    period_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["periodo", "period", "datas", "cronograma"]), None)
    if period_str and (period_spec.get("isVisible") is not False if period_spec else True):
        label = (period_spec.get("customLabel") or period_spec.get("colName") or "Período") if period_spec else "Período"
        grid_items.append((label, period_str, period_spec.get("order", 3) if period_spec else 3))

    # Dynamic short specs for header
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
            label = spec.get("customLabel") or spec.get("colName") or "Item"
            if len(val) > 50 or "\n" in val:
                long_dynamic_items.append((label, val, spec.get("order", 12)))
            else:
                grid_items.append((label, val, spec.get("order", 4)))

    grid_items.sort(key=lambda x: x[2])

    if grid_items:
        table_meta = doc.add_table(rows=0, cols=4 if orientation == "landscape" else 2)
        table_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_meta.autofit = True
        set_table_borders(table_meta, color="E2E8F0", sz="4")

        row = None
        cols_count = 4 if orientation == "landscape" else 2
        for idx, (label, val, _) in enumerate(grid_items):
            if idx % cols_count == 0:
                row = table_meta.add_row()
            cell = row.cells[idx % cols_count]
            set_cell_background(cell, "F8FAFC")
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r_lbl = p.add_run(f"{label.upper()}\n")
            r_lbl.bold = True
            r_lbl.font.size = Pt(8)
            r_lbl.font.color.rgb = RGBColor(100, 116, 139)
            r_val = p.add_run(val)
            r_val.font.size = Pt(9.5)
            r_val.font.color.rgb = RGBColor(15, 23, 42)

    # 4. Macro BNCC Objectives
    bncc_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["learningobjectives", "habilidades_bncc", "bncc", "habilidades", "objetivos_aprendizagem"]), None)
    show_bncc = (bncc_spec.get("isVisible") is not False if bncc_spec else True)
    macro_objs = planning.get("learningObjectives") or []

    if show_bncc and macro_objs:
        doc.add_paragraph().paragraph_format.space_after = Pt(2)
        p_bncc = doc.add_paragraph()
        p_bncc.paragraph_format.space_before = Pt(4)
        p_bncc.paragraph_format.space_after = Pt(2)
        r_b_hdr = p_bncc.add_run(f"✦ {(bncc_spec.get('customLabel') if bncc_spec and bncc_spec.get('customLabel') else 'Habilidades BNCC').upper()}")
        r_b_hdr.bold = True
        r_b_hdr.font.size = Pt(9.5)
        r_b_hdr.font.color.rgb = RGBColor(180, 83, 9) # Amber-700

        p_codes = doc.add_paragraph()
        p_codes.paragraph_format.space_before = Pt(0)
        p_codes.paragraph_format.space_after = Pt(4)
        for obj in macro_objs:
            code = (obj.get("bnccSkill") or {}).get("code") or "BNCC"
            desc = obj.get("customDescription") or (obj.get("bnccSkill") or {}).get("description") or ""
            r_code = p_codes.add_run(f"[{code}] ")
            r_code.bold = True
            r_code.font.size = Pt(9)
            r_code.font.color.rgb = RGBColor(146, 64, 14)
            if desc:
                r_desc = p_codes.add_run(f"{desc}   ")
                r_desc.font.size = Pt(8.5)
                r_desc.font.color.rgb = RGBColor(71, 85, 105)

    # 5. Macro Evaluations
    eval_spec = next((s for s in specifications if s.get("tableRef") == "PLANNING" and s.get("colName", "").lower() in ["evaluations", "avaliacao", "avaliacoes", "instrumento_avaliacao", "como_avaliar"]), None)
    show_eval = (eval_spec.get("isVisible") is not False if eval_spec else True)
    macro_evals = planning.get("evaluations") or []

    if show_eval and macro_evals:
        p_ev = doc.add_paragraph()
        p_ev.paragraph_format.space_before = Pt(4)
        p_ev.paragraph_format.space_after = Pt(2)
        r_ev_hdr = p_ev.add_run(f"✔ {(eval_spec.get('customLabel') if eval_spec and eval_spec.get('customLabel') else 'Avaliação da Aprendizagem').upper()}")
        r_ev_hdr.bold = True
        r_ev_hdr.font.size = Pt(9.5)
        r_ev_hdr.font.color.rgb = RGBColor(4, 120, 87) # Emerald-700

        for ev in macro_evals:
            p_item = doc.add_paragraph(style='List Bullet')
            p_item.paragraph_format.space_before = Pt(0)
            p_item.paragraph_format.space_after = Pt(2)
            name = ev.get("name") or "Instrumento Avaliativo"
            itype = ev.get("instrumentType")
            crit = ev.get("criteria")
            desc = ev.get("description")

            r_n = p_item.add_run(name)
            r_n.bold = True
            r_n.font.size = Pt(9)
            if itype:
                r_it = p_item.add_run(f" ({itype})")
                r_it.italic = True
                r_it.font.size = Pt(8.5)
            if desc:
                r_d = p_item.add_run(f": {desc}")
                r_d.font.size = Pt(8.5)
            if crit:
                r_c = p_item.add_run(f" — Critérios: {crit}")
                r_c.font.size = Pt(8.5)
                r_c.font.color.rgb = RGBColor(71, 85, 105)

    # 6. Long Dynamic Sections
    for label, val, _ in long_dynamic_items:
        p_l = doc.add_paragraph()
        p_l.paragraph_format.space_before = Pt(4)
        p_l.paragraph_format.space_after = Pt(2)
        r_l = p_l.add_run(f"{label.upper()}:")
        r_l.bold = True
        r_l.font.size = Pt(9.5)
        p_v = doc.add_paragraph()
        p_v.paragraph_format.space_before = Pt(0)
        p_v.paragraph_format.space_after = Pt(4)
        r_val = p_v.add_run(val)
        r_val.font.size = Pt(9)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # 7. Planning Blocks Table(s)
    blocks = planning.get("blocks") or []
    if not blocks:
        doc.add_paragraph("Nenhum bloco de planejamento cadastrado.")
        buf = io.BytesIO()
        doc.save(buf)
        filename = f"planejamento-{(comp_names[0] if comp_names else 'aula')}-{orientation}.docx"
        return buf.getvalue(), filename

    # Order spec & column specs for blocks
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

    # Build active columns definition
    active_cols = []
    if show_order:
        active_cols.append({
            "id": "order",
            "label": order_label,
            "order": order_spec.get("order", 0) if order_spec else 0,
            "width": Cm(3.2) if orientation == "landscape" else Cm(2.8)
        })
    if show_metodologia:
        active_cols.append({
            "id": "metodologia",
            "label": metodologia_label,
            "order": metodologia_spec.get("order", 1) if metodologia_spec else 1,
            "width": Cm(8.0) if orientation == "landscape" else Cm(5.5)
        })
    if show_bncc_blocks:
        active_cols.append({
            "id": "bncc",
            "label": bncc_block_label,
            "order": bncc_block_spec.get("order", 2) if bncc_block_spec else 2,
            "width": Cm(4.5) if orientation == "landscape" else Cm(3.5)
        })
    if show_eval_blocks:
        active_cols.append({
            "id": "evaluations",
            "label": eval_block_label,
            "order": eval_block_spec.get("order", 3) if eval_block_spec else 3,
            "width": Cm(4.5) if orientation == "landscape" else Cm(3.2)
        })
    for d_spec in dynamic_block_specs:
        active_cols.append({
            "id": f"spec_{d_spec.get('id')}",
            "spec": d_spec,
            "label": d_spec.get("customLabel") or d_spec.get("colName") or "Custom",
            "order": d_spec.get("order", 4),
            "width": Cm(4.0) if orientation == "landscape" else Cm(3.0)
        })

    active_cols.sort(key=lambda c: c["order"])

    # Organize blocks into hierarchy or flat list
    block_map = {b["id"]: b for b in blocks if "id" in b}
    roots = [b for b in blocks if not b.get("parentId")]
    roots.sort(key=lambda b: (b.get("order", 0), b.get("startAt") or ""))

    # Helper function to render a table for a list of blocks
    def render_blocks_table(target_blocks: List[Dict[str, Any]]):
        table = doc.add_table(rows=0, cols=len(active_cols))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        set_table_borders(table, color="CBD5E1", sz="4")

        # Header Row
        hdr_row = table.add_row()
        trPr = hdr_row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

        for c_idx, col_def in enumerate(active_cols):
            cell = hdr_row.cells[c_idx]
            cell.width = col_def["width"]
            set_cell_background(cell, "F1F5F9")
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(col_def["label"].upper())
            r.bold = True
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(15, 23, 42)

        # Body Rows
        for idx, block in enumerate(target_blocks):
            row = table.add_row()
            trPr = row._tr.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

            for c_idx, col_def in enumerate(active_cols):
                cell = row.cells[c_idx]
                cell.width = col_def["width"]
                cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
                set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)

                col_id = col_def["id"]
                if col_id == "order":
                    label = format_block_unit(block, idx, order_spec.get("customLabel") if order_spec else None)
                    dt_str = format_date_range(block.get("startAt"), block.get("endAt"))
                    r_lbl = p.add_run(label)
                    r_lbl.bold = True
                    r_lbl.font.size = Pt(9.5)
                    if dt_str:
                        p_dt = p.add_run(f"\n{dt_str}")
                        p_dt.font.size = Pt(8)
                        p_dt.font.color.rgb = RGBColor(100, 116, 139)
                elif col_id == "metodologia":
                    met = block.get("metodologia") or ""
                    r_met = p.add_run(met if met else "Metodologia em elaboração...")
                    r_met.font.size = Pt(9)
                    if not met:
                        r_met.italic = True
                        r_met.font.color.rgb = RGBColor(148, 163, 184)
                elif col_id == "bncc":
                    objs = block.get("learningObjectives") or []
                    if objs:
                        for o_idx, obj in enumerate(objs):
                            code = (obj.get("bnccSkill") or {}).get("code") or "BNCC"
                            desc = obj.get("customDescription") or (obj.get("bnccSkill") or {}).get("description") or ""
                            r_c = p.add_run(f"[{code}]" + ("\n" if o_idx < len(objs) - 1 else ""))
                            r_c.bold = True
                            r_c.font.size = Pt(8.5)
                            r_c.font.color.rgb = RGBColor(180, 83, 9)
                    else:
                        r_nil = p.add_run("—")
                        r_nil.font.size = Pt(8.5)
                        r_nil.font.color.rgb = RGBColor(148, 163, 184)
                elif col_id == "evaluations":
                    evals = block.get("evaluations") or []
                    if evals:
                        for e_idx, ev in enumerate(evals):
                            ev_name = ev.get("name") or ev.get("instrumentType") or "Avaliação"
                            ev_crit = ev.get("criteria")
                            r_en = p.add_run(f"• {ev_name}" + ("\n" if e_idx < len(evals) - 1 else ""))
                            r_en.bold = True
                            r_en.font.size = Pt(8.5)
                            if ev_crit:
                                r_ec = p.add_run(f"\n  {ev_crit}")
                                r_ec.font.size = Pt(8)
                                r_ec.font.color.rgb = RGBColor(100, 116, 139)
                    else:
                        r_nil = p.add_run("—")
                        r_nil.font.size = Pt(8.5)
                        r_nil.font.color.rgb = RGBColor(148, 163, 184)
                elif col_id.startswith("spec_"):
                    spec = col_def["spec"]
                    s_id = spec.get("id")
                    s_col = (spec.get("colName") or "").lower()
                    meta_vals = block.get("metadataValues") or []
                    m_val = next((m for m in meta_vals if m.get("specificationId") == s_id or (m.get("specification") and m["specification"].get("colName", "").lower() == s_col)), None)
                    t_val = m_val.get("textValue") if m_val else None
                    if t_val:
                        r_tv = p.add_run(t_val)
                        r_tv.font.size = Pt(9)
                    else:
                        r_nil = p.add_run("—")
                        r_nil.font.size = Pt(8.5)
                        r_nil.font.color.rgb = RGBColor(148, 163, 184)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Check if hierarchical structure exists
    has_children = any(b.get("parentId") for b in blocks)

    if has_children:
        # Hierarchical grouping
        for r_idx, root in enumerate(roots):
            child_blocks = [b for b in blocks if b.get("parentId") == root["id"]]
            child_blocks.sort(key=lambda b: (b.get("order", 0), b.get("startAt") or ""))

            # Section Header
            sec_title = format_block_unit(root, r_idx, order_spec.get("customLabel") if order_spec else None)
            sec_date = format_date_range(root.get("startAt"), root.get("endAt"))

            p_sec = doc.add_paragraph()
            p_sec.paragraph_format.space_before = Pt(8)
            p_sec.paragraph_format.space_after = Pt(2)
            r_sec = p_sec.add_run(f"§ {sec_title.upper()}")
            r_sec.bold = True
            r_sec.font.size = Pt(11)
            r_sec.font.color.rgb = RGBColor(15, 23, 42)
            if sec_date:
                r_sd = p_sec.add_run(f"   ({sec_date})")
                r_sd.font.size = Pt(9.5)
                r_sd.font.color.rgb = RGBColor(71, 85, 105)

            if root.get("metodologia") and show_metodologia:
                p_m = doc.add_paragraph()
                p_m.paragraph_format.space_before = Pt(0)
                p_m.paragraph_format.space_after = Pt(4)
                r_m = p_m.add_run(root["metodologia"])
                r_m.italic = True
                r_m.font.size = Pt(9)
                r_m.font.color.rgb = RGBColor(71, 85, 105)

            if child_blocks:
                render_blocks_table(child_blocks)
            else:
                render_blocks_table([root])
    else:
        # Flat structure
        render_blocks_table(roots)

    # Save to BytesIO
    buf = io.BytesIO()
    doc.save(buf)
    comp_slug = comp_names[0].replace(" ", "_") if comp_names else "aula"
    filename = f"planejamento-{comp_slug}-{orientation}.docx"
    return buf.getvalue(), filename
