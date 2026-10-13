/** Null when the package can be hard-deleted. */
export function packageInUseDeleteError(
  name: string,
  merchantCount: number,
  paymentCount: number
): string | null {
  if (merchantCount > 0) {
    return `Cannot delete "${name}": ${merchantCount} merchant(s) still use this package. Reassign them first.`;
  }
  if (paymentCount > 0) {
    return `Cannot delete "${name}": this package has billing history.`;
  }
  return null;
}

/** Null when the add-on can be hard-deleted. */
export function addonInUseDeleteError(
  name: string,
  subscriberCount: number,
  paymentCount: number
): string | null {
  if (subscriberCount > 0) {
    return `Cannot delete "${name}": merchants still subscribe to this add-on.`;
  }
  if (paymentCount > 0) {
    return `Cannot delete "${name}": this add-on has billing history.`;
  }
  return null;
}
