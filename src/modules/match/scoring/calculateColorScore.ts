


export const calculateColorScore = (
  itemColor?: string,
  reportColor?: string
): number => {
  if (!itemColor || !reportColor) return 0;

  // Normalized comparison
  const c1 = itemColor.toUpperCase();
  const c2 = reportColor.toUpperCase();

  if (c1 === c2) return 1.0;

  // Compatible colors (optional refinement)
  const compatible: Record<string, string[]> = {
    'GRAY': ['SILVER', 'BLACK', 'WHITE'],
    'SILVER': ['GRAY'],
    'GOLD': ['YELLOW', 'BEIGE'],
    'BEIGE': ['BROWN', 'WHITE', 'GOLD'],
    'RED': ['ORANGE', 'PINK', 'MAROON'],
    'BLUE': ['NAVY', 'TEAL', 'CYAN'],
  };

  if (compatible[c1]?.includes(c2) || compatible[c2]?.includes(c1)) {
    return 0.5;
  }

  return 0;
};
