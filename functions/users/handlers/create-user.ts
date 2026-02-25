/* import { CreateUserInput } from "../schemas/create-user.input";
import { prisma } from "@/lib/prisma";

export async function createUser(req: Request) {
  const body = CreateUserInput.parse(await req.json());

  const user = await prisma.user.create({
    data: body,
  });

  return Response.json(user);
} */