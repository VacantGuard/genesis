export type DeliveryAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

export const EMPTY_DELIVERY: DeliveryAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

export function cleanDeliveryField(value: unknown, max: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export function readDeliveryAddress(input: {
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
}): DeliveryAddress {
  return {
    line1: cleanDeliveryField(input.line1, 120),
    line2: cleanDeliveryField(input.line2, 80),
    city: cleanDeliveryField(input.city, 80),
    state: cleanDeliveryField(input.state, 40).toUpperCase(),
    postalCode: cleanDeliveryField(input.postalCode, 20),
  };
}

export function hasDeliveryAddress(address: DeliveryAddress) {
  return Boolean(address.line1 && address.city && address.state && address.postalCode);
}

export function formatDeliveryAddress(address: DeliveryAddress) {
  if (!hasDeliveryAddress(address)) return "";
  const street = address.line2 ? `${address.line1}, ${address.line2}` : address.line1;
  return `${street}, ${address.city}, ${address.state} ${address.postalCode}`;
}

/** Google Maps search URL so staff or the agent can open the drop pin. */
export function deliveryLocateUrl(address: DeliveryAddress) {
  const query = formatDeliveryAddress(address);
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function deliveryMapsQuery(address: DeliveryAddress) {
  return formatDeliveryAddress(address);
}

export function validateDeliveryAddress(address: DeliveryAddress): string | null {
  if (!address.line1 || address.line1.length < 3) {
    return "Enter a street address for delivery.";
  }
  if (!address.city || address.city.length < 2) {
    return "Enter the delivery city.";
  }
  if (!address.state || address.state.length < 2) {
    return "Enter the delivery state.";
  }
  if (!address.postalCode || address.postalCode.length < 3) {
    return "Enter the delivery ZIP or postal code.";
  }
  return null;
}
