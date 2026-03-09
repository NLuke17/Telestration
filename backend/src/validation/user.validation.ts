import { z } from 'zod';

/**
 * User management validation schemas
 */

// /user/delete-account
export const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required for account deletion'),
  }),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
