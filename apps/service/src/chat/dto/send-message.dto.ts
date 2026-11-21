import { z } from 'zod';

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, 'Mensagem não pode ser vazia'),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
