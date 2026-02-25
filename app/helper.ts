import { redirect } from "next/navigation";

export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
) {
  const encodedMessage = encodeURIComponent(message);
  const url = `${path}?${type}=${encodedMessage}`;

  return redirect(url);
}