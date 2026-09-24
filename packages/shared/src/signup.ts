/** Roles a person can choose in the app. Admin is seed or SQL promotion only. */
export function publicSignupRole(input: string | null | undefined): "customer" | "driver" {
  return input === "driver" ? "driver" : "customer";
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
