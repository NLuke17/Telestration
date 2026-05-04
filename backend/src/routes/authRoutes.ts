import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit"; 
import { createUser, listUsers, loginUser, refreshUserToken, logoutUser, logoutAllDevices, deleteUserAccount, getUserProfile, updateUserProfilePictureUrl } from "../services/authService";
import { persistUserAvatar } from "../services/avatarService";
import { validate } from "../middleware/validate";
import { createUserSchema, loginUserSchema, refreshTokenSchema } from "../validation/auth.validation";
import { deleteAccountSchema } from "../validation/user.validation";
import { authenticateJWT, AuthRequest } from "../middleware/authMiddleware";

const router = express.Router();

// Rate limiter for authentication attempts (login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { message: "Too many login attempts, please try again later" }, 
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for account creation (signup)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 account creations per hour per IP
  message: { message: "Too many accounts created from this IP, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for token refresh
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 refresh attempts
  message: { message: "Too many refresh attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const avatarUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { message: "Too many avatar uploads, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES + 4096 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(null, ok);
  },
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

router.get("/me", authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId as string;
    const profile = await getUserProfile(userId);
    return res.status(200).json(profile);
  } catch (error: any) {
    if (error?.message === "User not found") {
      return res.status(404).json({ message: "User not found" });
    }
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ message: "Failed to load profile", error: message });
  }
});

router.post(
  "/me/avatar",
  avatarUploadLimiter,
  authenticateJWT,
  avatarUpload.single("avatar"),
  async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ message: "No image file (field name: avatar)" });
      }
      const userId = req.user?.userId as string;
      const { publicUrl } = await persistUserAvatar(req, userId, file.buffer);
      const profile = await updateUserProfilePictureUrl(userId, publicUrl);
      return res.status(200).json(profile);
    } catch (error: any) {
      if (error?.message === "AVATAR_TOO_LARGE") {
        return res.status(413).json({ message: "Image must be 2 MB or smaller" });
      }
      if (error?.message === "AVATAR_INVALID_IMAGE") {
        return res.status(400).json({ message: "Only JPEG, PNG, or WebP images are allowed" });
      }
      if (error?.message === "AVATAR_PUBLIC_BASE_URL_REQUIRED_WITH_S3") {
        return res.status(500).json({ message: "Server misconfiguration: AVATAR_PUBLIC_BASE_URL required when using S3" });
      }
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ message: "Failed to update avatar", error: message });
    }
  }
);

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