import axios from "axios";
interface SupabaseError {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}

export const isSupabaseError = (error: unknown): error is SupabaseError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as SupabaseError).message === "string"
  );
};
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data ?? error.message;
  }
  if (isSupabaseError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong";
};

import { SupabaseClient } from "@supabase/supabase-js";

export const getURL = (path: string = "") => {
  // Check if NEXT_PUBLIC_SITE_URL is set and non-empty. Set this to your site URL in production env.
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL &&
    process.env.NEXT_PUBLIC_SITE_URL.trim() !== ""
      ? process.env.NEXT_PUBLIC_SITE_URL
      : // If not set, check for NEXT_PUBLIC_VERCEL_URL, which is automatically set by Vercel.
        process?.env?.NEXT_PUBLIC_VERCEL_URL &&
          process.env.NEXT_PUBLIC_VERCEL_URL.trim() !== ""
        ? process.env.NEXT_PUBLIC_VERCEL_URL
        : // If neither is set, default to localhost for local development.
          "http://localhost:3000/";

  // Trim the URL and remove trailing slash if exists.
  url = url.replace(/\/+$/, "");
  // Make sure to include `https://` when not localhost.
  url = url.includes("http") ? url : `https://${url}`;
  // Ensure path starts without a slash to avoid double slashes in the final URL.
  path = path.replace(/^\/+/, "");
  // Concatenate the URL and the path.
  const pathUrl = path ? `${url}/${path}` : url;
  return pathUrl;
};

export const getPersonFullName = (first_name: string, last_name: string) =>
  `${last_name}, ${first_name}`;

// export const getFilesFromFormData = (formData: FormData) => {
//   const files: Blob[] = [];
//   for (let [key, value] of formData.entries()) {
//     // Check if the value is a Blob
//     if (value instanceof Blob) {
//       // If it is, add it to the array
//       files.push(value);
//     }
//   }
//   return files;
// };

export const generateRandom6DigitsCode = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};

export const parseFormData = (formData: FormData, key: string) => {
  return JSON.parse((formData.get(key) as string) || "{}");
};

export const getPublicUrlFromFile = ({
  supabase,
  path,
  bucket,
}: {
  supabase: SupabaseClient;
  path: string;
  bucket: string;
}) => {
  const { data: publicURL } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicURL?.publicUrl;
};

export const getUniqueSlug = (str: string) =>
  removeAccents(str.replaceAll(" ", "_").toLowerCase());

const toastKeyMap = {
  status: ["status", "status_description"],
  error: ["error", "error_description"],
} as const;

export function parseJSON(value: FormDataEntryValue | null, defaultValue: any) {
  try {
    return JSON.parse((value as string) || JSON.stringify(defaultValue));
  } catch {
    return defaultValue;
  }
}
type ToastType = "status" | "error";
const getToastRedirect = (
  path: string,
  toastType: ToastType,
  toastName: string,
  toastDescription: string = "",
  disableButton: boolean = false,
  arbitraryParams: string = "",
): string => {
  const [nameKey, descriptionKey] = toastKeyMap[toastType];

  let redirectPath = `${path}?${nameKey}=${encodeURIComponent(toastName)}`;

  if (toastDescription) {
    redirectPath += `&${descriptionKey}=${encodeURIComponent(
      toastDescription,
    )}`;
  }

  if (disableButton) {
    redirectPath += `&disable_button=true`;
  }

  if (arbitraryParams) {
    redirectPath += `&${arbitraryParams}`;
  }

  return redirectPath;
};

export const getStatusRedirect = (
  path: string,
  statusName: string,
  statusDescription: string = "",
  disableButton: boolean = false,
  arbitraryParams: string = "",
) =>
  getToastRedirect(
    path,
    "status",
    statusName,
    statusDescription,
    disableButton,
    arbitraryParams,
  );

export const getErrorRedirect = (
  path: string,
  errorName: string,
  errorDescription: string = "",
  disableButton: boolean = false,
  arbitraryParams: string = "",
) =>
  getToastRedirect(
    path,
    "error",
    errorName,
    errorDescription,
    disableButton,
    arbitraryParams,
  );

export const camelCaseToWords = (s: string) => {
  const result = s.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export const snakeCaseToWords = (s: string) => {
  return s
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function removeAccents(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
export function capitalizeFirstLetter(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
