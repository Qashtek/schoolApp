import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().min(1, 'Description cannot be empty').optional(),
  grade: z.string().trim().min(1, 'Grade is required'),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
