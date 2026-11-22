import base64
import json
import traceback
from typing import Any, Dict

from docx_renderer import render_docx
from pdf_renderer import render_pdf


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    AWS Lambda handler para exportação de planejamentos escolares em PDF e DOCX.
    Suporta chamadas diretas via emulador RIE ou API Gateway.
    """
    try:
        body = event
        if isinstance(body, dict) and "body" in body and isinstance(body["body"], str):
            try:
                body = json.loads(body["body"])
            except Exception:
                pass

        if not isinstance(body, dict):
            body = {}

        export_format = (body.get("format") or "pdf").lower()
        orientation = (body.get("orientation") or "portrait").lower()
        planning = body.get("planning") or {}
        specifications = body.get("specifications") or []
        html_content = body.get("html")

        if export_format == "docx":
            file_bytes, filename = render_docx(planning, specifications, orientation)
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif export_format == "pdf":
            file_bytes, filename = render_pdf(
                planning, specifications, orientation, html_content=html_content
            )
            content_type = "application/pdf"
        else:
            return {
                "statusCode": 400,
                "body": json.dumps(
                    {
                        "error": f"Formato inválido: '{export_format}'. Suportados: 'pdf' e 'docx'."
                    }
                ),
            }

        encoded_data = base64.b64encode(file_bytes).decode("utf-8")
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": content_type,
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
            "isBase64Encoded": True,
            "body": encoded_data,
        }
    except Exception as e:
        traceback.print_exc()
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
