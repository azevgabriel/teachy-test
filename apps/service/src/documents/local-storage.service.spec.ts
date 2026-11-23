import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageService } from './local-storage.service.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NotFoundException } from '@nestjs/common';

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  const testDir = path.join('/tmp', `teachy-test-${Date.now()}`);

  beforeEach(() => {
    process.env.LOCAL_STORAGE_DIR = testDir;
    service = new LocalStorageService();
  });

  afterEach(async () => {
    try {
      if (fs.existsSync(testDir)) {
        await fs.promises.rm(testDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('saves file securely with UUID name and sanitized extension', async () => {
    const file = {
      originalname: 'matriz-curricular-2026.pdf',
      buffer: Buffer.from('conteudo teste pdf'),
      mimetype: 'application/pdf',
    };

    const result = await service.saveFile(file);

    expect(result.storedFileName).toMatch(/^[0-9a-f-]+\.pdf$/);
    expect(result.localFilePath).toBe(path.join(testDir, result.storedFileName));
    expect(fs.existsSync(result.localFilePath)).toBe(true);
    const content = await fs.promises.readFile(result.localFilePath, 'utf8');
    expect(content).toBe('conteudo teste pdf');
  });

  it('sanitizes malicious filename with path traversal characters', async () => {
    const file = {
      originalname: '../../../etc/passwd.docx',
      buffer: Buffer.from('conteudo docx'),
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const result = await service.saveFile(file);

    expect(result.storedFileName).toMatch(/^[0-9a-f-]+\.docx$/);
    expect(result.localFilePath.startsWith(testDir)).toBe(true);
  });

  it('retrieves read stream for existing file', async () => {
    const file = {
      originalname: 'teste.png',
      buffer: Buffer.from('dados png'),
    };
    const saved = await service.saveFile(file);

    const stream = service.getFileStream(saved.localFilePath);
    expect(stream).toBeDefined();

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe('dados png');
  });

  it('throws NotFoundException when file does not exist', () => {
    expect(() =>
      service.getFileStream(path.join(testDir, 'inexistente.pdf')),
    ).toThrow(NotFoundException);
  });

  it('throws NotFoundException when path attempts path traversal', () => {
    expect(() => service.getFileStream('/etc/passwd')).toThrow(
      NotFoundException,
    );
  });

  it('reads file buffer for existing file', async () => {
    const file = {
      originalname: 'leitura.pdf',
      buffer: Buffer.from('buffer para leitura'),
    };
    const saved = await service.saveFile(file);

    const read = await service.readFile(saved.localFilePath);
    expect(read.toString()).toBe('buffer para leitura');
  });

  it('deletes file successfully from disk', async () => {
    const saved = await service.saveFile({
      originalname: 'deletar.pdf',
      buffer: Buffer.from('deletar'),
    });

    expect(fs.existsSync(saved.localFilePath)).toBe(true);
    const deleted = await service.deleteFile(saved.localFilePath);
    expect(deleted).toBe(true);
    expect(fs.existsSync(saved.localFilePath)).toBe(false);
  });
});
