import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

/**
 * Generic validation middleware factory
 * 
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 * 
 * @example
 * router.post('/', validate(createUserSchema), userController.create);
 */
export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request data (body, params, query)
      await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      next();
    } catch (error: any) {
      if (error?.issues) {
        const errorMessages = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          error: 'Validation failed',
          details: errorMessages,
        });
        return;
      }

      // Unexpected error
      res.status(500).json({
        error: 'Internal validation error',
      });
    }
  };
};
