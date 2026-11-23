import assert from "node:assert/strict";
import test from "node:test";
import { formatFileSize, validateUploadFile } from "./types";

test("validateUploadFile: aceita formatos permitidos (.pdf, .docx, .png, .jpg, .jpeg, .webp)", () => {
	const validFiles = [
		{ name: "matriz.pdf", type: "application/pdf", size: 1024 },
		{
			name: "plano.docx",
			type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			size: 2048,
		},
		{ name: "foto.png", type: "image/png", size: 5000 },
		{ name: "foto.jpeg", type: "image/jpeg", size: 5000 },
		{ name: "foto.jpg", type: "image/jpeg", size: 5000 },
		{ name: "foto.webp", type: "image/webp", size: 5000 },
	];

	for (const f of validFiles) {
		const res = validateUploadFile(f as File);
		assert.equal(res.valid, true, `Deveria aceitar ${f.name}`);
	}
});

test("validateUploadFile: rejeita formatos não suportados", () => {
	const invalidFiles = [
		{ name: "virus.exe", type: "application/x-msdownload", size: 1024 },
		{ name: "arquivo.zip", type: "application/zip", size: 1024 },
		{ name: "musica.mp3", type: "audio/mpeg", size: 1024 },
		{ name: "planilha.xlsx", type: "application/vnd.ms-excel", size: 1024 },
	];

	for (const f of invalidFiles) {
		const res = validateUploadFile(f as File);
		assert.equal(res.valid, false, `Deveria rejeitar ${f.name}`);
		assert.ok(
			res.error?.includes("Formato inválido"),
			`Mensagem deve indicar formato inválido para ${f.name}`,
		);
	}
});

test("validateUploadFile: rejeita arquivos que excedam 20MB", () => {
	const largeFile = {
		name: "grande.pdf",
		type: "application/pdf",
		size: 21 * 1024 * 1024,
	};

	const res = validateUploadFile(largeFile as File);
	assert.equal(res.valid, false);
	assert.ok(res.error?.includes("20MB"));
});

test("formatFileSize: formata bytes em unidades legíveis", () => {
	assert.equal(formatFileSize(0), "0 B");
	assert.equal(formatFileSize(500), "500 B");
	assert.equal(formatFileSize(1024), "1 KB");
	assert.equal(formatFileSize(1024 * 350), "350 KB");
	assert.equal(formatFileSize(1024 * 1024 * 2.5), "2.5 MB");
});
