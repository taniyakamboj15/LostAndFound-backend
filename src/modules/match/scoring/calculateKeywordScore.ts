export const calculateKeywordScore = (
  itemKeywords: string[],
  reportKeywords: string[]
): number => {
  const hasKeywords = Boolean(itemKeywords.length && reportKeywords.length);

  const calculate = () => {
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'of', 'with']);
    
    // FP filter
    const filterKeywords = (keywords: string[]) => 
      keywords.filter(k => !stopWords.has(k) && k.length > 2);

    const k1 = filterKeywords(itemKeywords);
    const k2 = filterKeywords(reportKeywords);

    const validKeywords = Boolean(k1.length && k2.length);

    const performCalculation = () => {
      const intersection = k1.filter((k) =>
        k2.some(k2Word => k2Word.includes(k) || k.includes(k2Word))
      ).length;
      
      const union = new Set([...k1, ...k2]).size;

      // Avoid division by zero with map/object lookup (though union 0 is handled by early return conceptually)
      return transformScore(intersection, union);
    };

    const strategies = {
      true: performCalculation,
      false: () => 0
    };

    return strategies[String(validKeywords) as keyof typeof strategies]();
  };

  const mainStrategies = {
    true: calculate,
    false: () => 0
  };

  return mainStrategies[String(hasKeywords) as keyof typeof mainStrategies]();
};

// Helper to avoid division by zero if it were possible, 
// though logically union > 0 if validKeywords is true.
const transformScore = (intersection: number, union: number): number => {
    const safeDiv = {
        true: () => intersection / union,
        false: () => 0,
    };
    return safeDiv[String(union > 0) as keyof typeof safeDiv]();
}
