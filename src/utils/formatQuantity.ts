const quantityFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** Compact quantities with grouping, without unnecessary trailing decimals. */
export const formatQuantity = (value: number): string => quantityFormatter.format(value);
