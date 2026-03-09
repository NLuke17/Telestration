import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("ERROR: JWT_SECRET is not defined in the environment variables.");
}

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
      if (err) {
        res.status(403).json({ message: "Forbidden: Invalid or expired token" });
        return;
      }

      req.user = decodedUser;
      next(); 
    });
  } else {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }
};