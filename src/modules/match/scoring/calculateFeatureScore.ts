export const calculateFeatureScore = (
  itemFeatures: string[],
  reportFeatures: string[],
  itemBrand?: string,
  reportBrand?: string,
  itemSize?: string,
  reportSize?: string,
  itemContents?: string | string[],
  reportContents?: string | string[]
): number => {
  let score = 0;
  let totalWeight = 0;

  // 1. Text Features (Weight: 0.15)
  const featureWeight = 0.15;
  totalWeight += featureWeight;
  
  if (itemFeatures.length > 0 && reportFeatures.length > 0) {
    const normalizeText = (text: string): string => 
        text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    const f1 = itemFeatures.map(normalizeText);
    const f2 = reportFeatures.map(normalizeText);

    const matches = f1.filter(f => 
       f2.some(rf => rf.includes(f) || f.includes(rf))
    ).length;
    
    // Normalize by max features to avoid over-scoring small overlap
    const maxFeatures = Math.max(f1.length, f2.length);
    if (maxFeatures > 0) {
        score += (matches / maxFeatures) * featureWeight;
    }
  }

  // 2. Brand (Weight: 0.55)
  const brandWeight = 0.55;
  totalWeight += brandWeight;
  if (itemBrand && reportBrand) {
    const b1 = itemBrand.toLowerCase();
    const b2 = reportBrand.toLowerCase();
    if (b1 === b2) {
      score += brandWeight;
    } else if (b1.includes(b2) || b2.includes(b1)) {
      score += brandWeight * 0.8;
    }
  }

  // 3. Size (Weight: 0.22)
  const sizeWeight = 0.22;
  totalWeight += sizeWeight;
  if (itemSize && reportSize) {
    if (itemSize === reportSize) {
      score += sizeWeight;
    }
  }

  // 4. Bag Contents (Weight: 0.08)
  const contentsWeight = 0.08;
  totalWeight += contentsWeight;
  if (itemContents && reportContents) {
     const iContents = Array.isArray(itemContents) ? itemContents.join(' ') : itemContents;
     const rContents = Array.isArray(reportContents) ? reportContents.join(' ') : reportContents;

     const itemWords = iContents.toLowerCase().split(/\s+/).filter(w => w.length > 2);
     const reportWords = rContents.toLowerCase().split(/\s+/).filter(w => w.length > 2);
     
     if (itemWords.length > 0 && reportWords.length > 0) {
        const matches = itemWords.filter(w => reportWords.includes(w)).length;
        const union = new Set([...itemWords, ...reportWords]).size;
        if (union > 0) {
            score += (matches / union) * contentsWeight;
        }
     }
  } else {
      // If bag contents not applicable (not BAGS), distribute weight back? 
      // Or just ignore. For simplicity, we ignore (score stays lower?). 
      // Actually, if missing, we shouldn't penalize if not relevant.
      // But here we assume relevant if present.
  }

  // Normalize final score to 0-1 based on active components
  // But to keep it simple and conservative:
  // We return the raw accumulated weighted score.
  // Maximum possible is 1.0 (0.4 + 0.3 + 0.1 + 0.2).
  
  return parseFloat(score.toFixed(2));
};
