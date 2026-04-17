import prisma from "../prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Use environment variables for both secrets!
const JWT_SECRET = process.env.JWT_SECRET as string;
const REFRESH_SECRET = process.env.REFRESH_SECRET as string;

// Security constants
const BCRYPT_ROUNDS = 12; // Industry standard (10 is too weak)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

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

  //Hash the password with secure salt rounds
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  
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
    // Use timing-safe error to prevent username enumeration
    // Still perform bcrypt compare to prevent timing attacks
    await bcrypt.compare(password, '$2b$12$dummyhashtopreventtimingattack1234567890123456789');
    throw new Error("Invalid username or password");
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new Error(`Account is locked. Try again in ${minutesLeft} minute(s)`);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    // Increment failed login attempts
    const newAttempts = user.loginAttempts + 1;
    const updateData: any = {
      loginAttempts: newAttempts,
    };

    // Lock account if max attempts reached
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCK_TIME);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      throw new Error(`Account locked due to too many failed attempts. Try again in 15 minutes`);
    }

    throw new Error("Invalid username or password");
  }

  // Reset login attempts on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
    },
  });

  //Generate a short-lived Access Token
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "15m" } 
  );

  //Generate a cryptographically secure refresh token
  const refreshTokenValue = crypto.randomBytes(64).toString('hex');
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      token: refreshTokenValue,
      userId: user.id,
      expiresAt: refreshTokenExpiry,
    },
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    user: {
      id: user.id,
      username: user.username,
      profilePicture: user.profilePicture,
      totalVotesReceived: user.totalVotesReceived,
      wins: user.wins,
      gamesPlayed: user.gamesPlayed,
    },
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      profilePicture: true,
      createdAt: true,
      totalVotesReceived: true,
      wins: true,
      gamesPlayed: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function updateUserProfilePictureUrl(userId: string, profilePicture: string | null) {
  return prisma.user.update({
    where: { id: userId },
    data: { profilePicture },
    select: {
      id: true,
      username: true,
      profilePicture: true,
      createdAt: true,
      totalVotesReceived: true,
      wins: true,
      gamesPlayed: true,
    },
  });
}

export async function refreshUserToken(token: string) {
  // Find the refresh token in the database
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt) {
    throw new Error("Invalid or expired refresh token. Please log in again.");
  }

  // Check if token is expired
  if (storedToken.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });
    throw new Error("Invalid or expired refresh token. Please log in again.");
  }

  // Issue a new access token
  const newAccessToken = jwt.sign(
    { userId: storedToken.user.id, username: storedToken.user.username },
    JWT_SECRET,
    { expiresIn: "15m" }
  );

  // Implement refresh token rotation for security
  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Generate and store new refresh token
  const newRefreshTokenValue = crypto.randomBytes(64).toString('hex');
  const newRefreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      token: newRefreshTokenValue,
      userId: storedToken.user.id,
      expiresAt: newRefreshTokenExpiry,
    },
  });

  return { 
    accessToken: newAccessToken,
    refreshToken: newRefreshTokenValue // Return new refresh token
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

/**
 * Logout user by revoking their refresh token
 */
export async function logoutUser(token: string) {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!storedToken) {
    throw new Error("Invalid refresh token");
  }

  // Revoke the refresh token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  return { message: "Logged out successfully" };
}

/**
 * Logout from all devices by revoking all user's refresh tokens
 */
export async function logoutAllDevices(userId: string) {
  // Revoke all active refresh tokens for this user
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return { message: "Logged out from all devices", revokedCount: result.count };
}

/**
 * Delete user account and all associated data
 */
export async function deleteUserAccount(userId: string, password: string) {
  // Verify user exists and password is correct
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Verify password before deletion
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid password");
  }

  // Delete user (cascade will handle related data via onDelete: Cascade)
  // RefreshTokens, and other relations will be automatically deleted
  await prisma.user.delete({
    where: { id: userId },
  });

  return { message: "Account deleted successfully" };
}

/**
 * Clean up expired and revoked tokens (should be run periodically)
 */
export async function cleanupExpiredTokens() {
  const deleted = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  });

  return { deletedCount: deleted.count };
}