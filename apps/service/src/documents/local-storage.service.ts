import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface SavedFileResult {
  storedFileName: string;
  localFilePath: string;
}

@Injectable()
export class LocalStorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = process.env.LOCAL_STORAGE_DIR || '/tmp/teachy-uploads';
  }

  getStorageDirectory(): string {
    return this.storageDir;
  }

  async saveFile(file: {
    originalname: string;
    buffer: Buffer;
    mimetype?: string;
  }): Promise<SavedFileResult> {
    await fs.promises.mkdir(this.storageDir, { recursive: true });

    // Sanitizar nome original removendo path traversal e caracteres perigosos
    const sanitizedOriginal = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const ext = path.extname(sanitizedOriginal).toLowerCase();
    const storedFileName = `${randomUUID()}${ext}`;
    const localFilePath = path.join(this.storageDir, storedFileName);

    await fs.promises.writeFile(localFilePath, file.buffer);

    return {
      storedFileName,
      localFilePath,
    };
  }

  getFileStream(localFilePath: string): fs.ReadStream {
    const resolvedPath = path.resolve(localFilePath);
    const resolvedStorageDir = path.resolve(this.storageDir);

    // Proteção contra path traversal
    if (!resolvedPath.startsWith(resolvedStorageDir)) {
      throw new NotFoundException('Acesso negado ao arquivo solicitado.');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Arquivo físico não encontrado no servidor.');
    }

    return fs.createReadStream(resolvedPath);
  }

  async readFile(localFilePath: string): Promise<Buffer> {
    const resolvedPath = path.resolve(localFilePath);
    const resolvedStorageDir = path.resolve(this.storageDir);

    if (!resolvedPath.startsWith(resolvedStorageDir)) {
      throw new NotFoundException('Acesso negado ao arquivo solicitado.');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Arquivo físico não encontrado no servidor.');
    }

    return fs.promises.readFile(resolvedPath);
  }

  async deleteFile(localFilePath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(localFilePath);
      const resolvedStorageDir = path.resolve(this.storageDir);

      if (!resolvedPath.startsWith(resolvedStorageDir)) {
        return false;
      }

      if (fs.existsSync(resolvedPath)) {
        await fs.promises.unlink(resolvedPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
