import express from "express";
import { createUser, listUsers } from "../services/authService";
import { validate } from "../middleware/validate";
import { createUserSchema } from "../validation/auth.validation";

const router = express.Router();

router.post("/create-user", validate(createUserSchema), async (req, res) => {
  const { username, password, profilePicture } = req.body;

  try {
    const user = await createUser(username, password, profilePicture);
    return res.status(201).json(user);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "username already exists" });
    }
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ message: "Failed to create user", error: message });
  }
});

router.get("/all-users", async (_req, res) => {
  try {
    const users = await listUsers();
    return res.status(200).json(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ message: "Failed to get users", error: message });
  }
});

export default router;
