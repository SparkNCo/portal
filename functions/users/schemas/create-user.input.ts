import { z } from "zod";

export const CreateUserInput = z.object({
  email: z.string().email(),
  name: z.string().min(1),
}).openapi({
  title: "CreateUserInput",
});