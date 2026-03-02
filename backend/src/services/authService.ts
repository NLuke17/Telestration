import prisma from "../prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-me"; 

export async function createUser(username: string, password: string, profilePicture?: string) {
  
  const hashedPassword = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { username, password, profilePicture },
    select: {
      id: true,
      username: true,
      profilePicture: true,
      createdAt: true,
    },
  });
}

export async function loginUser(username: string, password: string) {
  // 1. Find the user
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    throw new Error("Invalid username or password");
  }

  // 2. Compare the typed password with the hashed password in the database
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    throw new Error("Invalid username or password");
  }

  // 3. Generate the JWT token
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      profilePicture: user.profilePicture,
    },
  };
}

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      profilePicture: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
