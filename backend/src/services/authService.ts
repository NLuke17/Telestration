import prisma from "../prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Use environment variables for both secrets!
const JWT_SECRET = process.env.JWT_SECRET 
const REFRESH_SECRET = process.env.REFRESH_SECRET 

if (!JWT_SECRET) {
  throw new Error("ERROR: JWT_SECRET is not defined in the environment variables.");
}

if (!REFRESH_SECRET) {
  throw new Error("ERROR: REFRESH_SECRET is not defined in the environment variables.");
}

export async function createUser(username: string, password: string, profilePicture?: string) {
  //Check if it is already taken
  const existingUser = await prisma.user.findUnique({ 
    where: { username } 
  });
  if (existingUser) {
    throw new Error("Username is already taken");
  }

  //Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  return prisma.user.create({
    data: { username, password: hashedPassword, profilePicture },
    select: {
      id: true,
      username: true,
      profilePicture: true,
      createdAt: true,
    },
  });
}

export async function loginUser(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    throw new Error("Invalid username or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    throw new Error("Invalid username or password");
  }

  //Generate a short-lived Access Token
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "15m" } 
  );

  //Generate a long-lived Refresh Token
  const refreshToken = jwt.sign(
    { userId: user.id, username: user.username },
    REFRESH_SECRET,
    { expiresIn: "7d" } 
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      profilePicture: user.profilePicture,
    },
  };
}

export async function refreshUserToken(token: string) {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as any;
    
    // Issue a new access token for another 15 minutes
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, username: decoded.username },
      JWT_SECRET,
      { expiresIn: "15m" }
    );
    
    return { accessToken: newAccessToken };
  } catch (error) {
    throw new Error("Invalid or expired refresh token. Please log in again.");
  }
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