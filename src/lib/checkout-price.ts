/** Checkout promotion. Menu rows keep their stored prices. */
export const CHECKOUT_MEAL_CENTS = 1500;
export const CHECKOUT_VOLUME_CENTS = 1200;
export const CHECKOUT_VOLUME_COUNT = 5;

export function checkoutUnitCents(mealCount: number) {
  return mealCount >= CHECKOUT_VOLUME_COUNT ? CHECKOUT_VOLUME_CENTS : CHECKOUT_MEAL_CENTS;
}
