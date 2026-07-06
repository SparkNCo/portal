const PHONE_FORMAT_REGEX = /^\+?[0-9]+(?:[\s\-()][0-9]+)*$/;

export function isValidPhone(phone: string): boolean {
  if (!phone) return true;

  if (!PHONE_FORMAT_REGEX.test(phone)) return false;

  const digitCount = phone.replace(/\D/g, "").length;
  return digitCount >= 7 && digitCount <= 15;
}
