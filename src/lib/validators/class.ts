import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  grade: z.string().min(1, 'Grade is required'),
  schoolId: z.string().optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
