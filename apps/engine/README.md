# Rendering Microservice (`apps/engine`)

Microsserviço baseado em container Docker compatível com AWS Lambda para exportação de planos de ensino em alta fidelidade para **PDF** (via Playwright / Chromium headless) e **DOCX** (via `python-docx`).

---

## 🚀 Arquitetura & Especificações

- **Imagem Base:** `public.ecr.aws/lambda/python:3.12` (Amazon Linux 2023 com emulador RIE embutido na porta `8080`).
- **Motor PDF:** Playwright Python rodando Chromium headless em modo sandbox seguro, compilando HTML/CSS para A4 (Retrato / Paisagem) com fidelidade absoluta de estilos e quebras de página.
- **Motor DOCX:** `python-docx` para geração nativa de arquivos `.docx` do Word/Google Docs com tabelas formatadas, células editáveis, cabeçalhos sombreados e metadados dinâmicos (EAV).
- **Invocação Local:** AWS Lambda Runtime Interface Emulator (RIE):
  `POST http://localhost:8080/2015-03-31/functions/function/invocations`

---

## 📦 Payload de Entrada

```json
{
  "format": "pdf", // ou "docx"
  "orientation": "portrait", // ou "landscape"
  "planning": { ... },
  "specifications": [ ... ],
  "html": "<html>...</html>" // opcional para renderização direta em PDF
}
```

## 📤 Retorno

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=\"planejamento-aula-portrait.pdf\""
  },
  "isBase64Encoded": true,
  "body": "<base64_string>"
}
```
