export type MockCardInput = {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
};

export type MockCardResult =
  | { ok: true; last4: string }
  | { ok: false; error: string };

function parseExpiry(raw: string): { month: number; year: number } | null {
  const trimmed = raw.trim();
  const labeled = trimmed.match(/^(\d{1,2})\s*[/\-]\s*(\d{2}|\d{4})$/);
  let month: number;
  let year: number;
  if (labeled) {
    month = Number(labeled[1]);
    year = Number(labeled[2]);
    if (labeled[2].length === 2) year += 2000;
  } else {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length !== 4 && digits.length !== 6) return null;
    month = Number(digits.slice(0, 2));
    year = Number(digits.slice(2));
    if (digits.length === 4) year += 2000;
  }
  if (month < 1 || month > 12 || year < 2000 || year > 2099) return null;
  return { month, year };
}

function luhnOk(digits: string) {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function validateMockCard(input: MockCardInput): MockCardResult {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, error: "Enter the name on the card." };
  }

  const digits = input.number.replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(digits) || !luhnOk(digits)) {
    return {
      ok: false,
      error: "Enter a card number that passes a basic check. Nothing is charged.",
    };
  }

  const parsed = parseExpiry(input.expiry);
  if (!parsed) {
    return { ok: false, error: "Enter the expiry as MM/YY." };
  }
  const expires = new Date(parsed.year, parsed.month, 1);
  if (expires <= new Date()) {
    return { ok: false, error: "That card is expired." };
  }

  if (!/^\d{3,4}$/.test(input.cvc.trim())) {
    return { ok: false, error: "Enter the 3- or 4-digit security code." };
  }

  return { ok: true, last4: digits.slice(-4) };
}
