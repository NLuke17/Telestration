import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Use the exact same secret you use in your authService when signing the token!
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-me";

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