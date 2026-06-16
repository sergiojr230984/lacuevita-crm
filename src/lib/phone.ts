export function normalizePhone(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function phoneEquals(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizePhone(left) === normalizePhone(right);
}

export function formatPhone(value: string | null | undefined): string {
  const normalized = normalizePhone(value);
  const match = normalized.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!match) {
    return normalized || "Unknown";
  }

  return `(${match[1]}) ${match[2]}-${match[3]}`;
}

