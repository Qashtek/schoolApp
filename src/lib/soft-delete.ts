import prisma from './prisma';

/**
 * Soft deletes a record by setting its deletedAt timestamp to now
 * @param model - The Prisma model name (e.g., 'student', 'teacher', 'class')
 * @param id - The record ID to soft delete
 * @throws Error if the model doesn't exist
 */
export async function softDelete(model: string, id: string): Promise<void> {
  const modelClient = (prisma as any)[model];

  if (!modelClient) {
    throw new Error(`Model "${model}" not found in Prisma client`);
  }

  await modelClient.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * Returns a Prisma where clause that filters out soft-deleted records
 * Use this in your queries to exclude deleted records by default
 * @returns Where clause object: { deletedAt: null }
 */
export function withoutDeleted() {
  return { deletedAt: null };
}
