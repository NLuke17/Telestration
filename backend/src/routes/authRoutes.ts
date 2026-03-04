import express from "express";
import rateLimit from "express-rate-limit"; 
import { createUser, listUsers, loginUser, refreshUserToken } from "../services/authService";
import { validate } from "../middleware/validate";
import { createUserSchema, loginUserSchema, refreshTokenSchema } from "../validation/auth.validation";
import { authenticateJWT } from "../middleware/authMiddleware";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,
  message: { message: "Too many attempts, please try again later" }, 
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/create-user", validate(createUserSchema), async (req, res) => {
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

router.post("/refresh", validate(refreshTokenSchema), async (req, res) => {
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

export default router;