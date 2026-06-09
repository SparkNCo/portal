export const API_HEADERS = {
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
  apikey: process.env.NEXT_PUBLIC_APIKEY!,
};

export const API_JSON_HEADERS = {
  ...API_HEADERS,
  "Content-Type": "application/json",
};
