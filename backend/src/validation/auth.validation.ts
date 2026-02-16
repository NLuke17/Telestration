import { z } from 'zod';

/**
 * Authentication validation schemas
 */

// POST /auth/create-user
export const createUserSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must not exceed 30 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must not exceed 100 characters'),
    profilePicture: z.string().url('Profile picture must be a valid URL').optional(),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
