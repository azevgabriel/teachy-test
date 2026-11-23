import { z } from 'zod';

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, 'Mensagem não pode ser vazia'),
  attachment: z
    .object({
      id: z.string().optional(),
      name: z.string(),
      size: z.number().optional(),
      mimeType: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
  documentId: z.string().optional(),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
