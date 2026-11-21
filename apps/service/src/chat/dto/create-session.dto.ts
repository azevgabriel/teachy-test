import { z } from 'zod';

export const createSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export type CreateSessionDto = z.infer<typeof createSessionSchema>;
