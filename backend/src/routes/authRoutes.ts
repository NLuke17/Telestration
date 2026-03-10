import express from "express";
// @ts-ignore - express-rate-limit v8 has built-in types but may need TS server restart
import rateLimit from "express-rate-limit"; 
import { createUser, listUsers, loginUser, refreshUserToken, logoutUser, logoutAllDevices, deleteUserAccount } from "../services/authService";
import { validate } from "../middleware/validate";
import { createUserSchema, loginUserSchema, refreshTokenSchema } from "../validation/auth.validation";
import { deleteAccountSchema } from "../validation/user.validation";
import { authenticateJWT } from "../middleware/authMiddleware";

const router = express.Router();

// Rate limiter for authentication attempts (login)
// Key by username instead of IP to avoid issues with proxies/Docker
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, 
  message: { message: "Too many login attempts, please try again later" }, 
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use username as key if provided, otherwise use a generic key
    return req.body?.username || 'default-key';
  },
  // Skip rate limiting in development if DISABLE_RATE_LIMIT is set
  skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true',
});

// Rate limiter for account creation (signup)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 accounts per hour (much higher for multi-user scenarios)
  message: { message: "Too many accounts created, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use username as key to prevent duplicate usernames
    return req.body?.username || 'default-key';
  },
  skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true',
});

// Rate limiter for token refresh
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 refresh attempts
  message: { message: "Too many refresh attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true',
});

router.post("/create-user", signupLimiter, validate(createUserSchema), async (req, res) => {
  const { username, password, profilePicture } = req.body;

  try {
    const user = await createUser(username, password, profilePicture);
    return res.status(201).json(user);
  } catch (error: any) {
    if (error?.code === "P2002" || error.message === "Username is already taken") {
      return res.status(409).json({ message: "Username is already taken" });
    }
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ message: "Failed to create user", error: message });
  }
});


router.post("/login", authLimiter, validate(loginUserSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await loginUser(username, password);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
});

router.post("/refresh", refreshLimiter, validate(refreshTokenSchema), async (req, res) => {
  const { token } = req.body;

  try {
    const result = await refreshUserToken(token);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
});

router.get("/all-users", authenticateJWT, async (_req, res) => {
  try {
    const users = await listUsers();
    return res.status(200).json(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ message: "Failed to get users", error: message });
  }
});

router.post("/logout", validate(refreshTokenSchema), async (req, res) => {
  const { token } = req.body;

  try {
    const result = await logoutUser(token);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
});

router.post("/logout-all", authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await logoutAllDevices(userId);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/delete-account", authenticateJWT, validate(deleteAccountSchema), async (req, res) => {
  const { password } = req.body;
  
  try {
    const userId = (req as any).user.userId;
    const result = await deleteUserAccount(userId, password);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "Invalid password") {
      return res.status(401).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to delete account", error: error.message });
  }
});

export default router;