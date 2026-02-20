export const calculateLocationScore = (
    locationFound: string,
    locationLost: string
  ): number => {
    
    // Normalize logic
    const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    // Expansion logic
    const expansions: Record<string, string> = {
        't1': 'terminal 1',
        't2': 'terminal 2',
        't3': 'terminal 3',
        'apt': 'apartment',
        'st': 'street',
        'ave': 'avenue',
        'rd': 'road',
        'rm': 'room',
        'flr': 'floor',
        'lib': 'library',
        'dept': 'department',
        'bldg': 'building',
    };

    const expand = (text: string) => text.split(' ').map(word => expansions[word] || word).join(' ');

    const s1 = expand(normalize(locationFound));
    const s2 = expand(normalize(locationLost));

    // Exact match strategy
    const isExact = s1 === s2;
    // Partial match strategy
    const isPartial = s1.includes(s2) || s2.includes(s1);

    // Token match strategy
    const calculateTokenMatch = () => {
        const words1 = s1.split(/\s+/);
        const words2 = s2.split(/\s+/);

        const intersection = words1.filter(w1 => 
            words2.some(w2 => w2 === w1 || (w2.length > 4 && w1.includes(w2)))
        ).length;

        return intersection / Math.max(words1.length, words2.length);
    };

    // Strategic lookup table (simulating if/else chain)
    // Priority: Exact > Partial > Token
    const strategies = [
        { check: isExact, value: () => 1.0 },
        { check: isPartial, value: () => 0.9 },
        { check: true, value: calculateTokenMatch } // Fallback
    ];

    const match = strategies.find(s => s.check);
    
    // We know match will exist because of the fallback, but TS might not know
    const getValue = match?.value || (() => 0); 
    
    return getValue();
  };
