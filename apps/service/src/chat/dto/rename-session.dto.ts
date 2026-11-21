import { z } from 'zod';

export const renameSessionSchema = z.object({
  name: z.string().trim().min(1, 'O nome da sessão não pode ser vazio.').max(100),
});

export type RenameSessionDto = z.infer<typeof renameSessionSchema>;
