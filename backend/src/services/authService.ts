import prisma from "../prismaClient";

export async function createUser(username: string, password: string, profilePicture?: string) {
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
