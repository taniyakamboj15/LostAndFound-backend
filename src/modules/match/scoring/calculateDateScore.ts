export const calculateDateScore = (dateFound: Date, dateLost: Date): number => {
  const daysDiff = Math.abs(
    (dateFound.getTime() - dateLost.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Map-based range check
  const scoreMap = [
    { limit: 0, score: 1.0 },
    { limit: 1, score: 0.95 },
    { limit: 3, score: 0.8 },
    { limit: 7, score: 0.6 },
    { limit: 14, score: 0.4 },
    { limit: Infinity, score: 0.1 },
  ];

  // Find the first matching limit
  const match = scoreMap.find(s => daysDiff <= s.limit);
  
  // Implicitly handles the fallback via Infinity
  return match?.score || 0.1; 
};
