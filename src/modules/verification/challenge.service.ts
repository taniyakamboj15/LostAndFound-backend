import { IItem } from '../item/item.model';

interface IChallengeService {
  generateChallenge(item: IItem): string[];
}

class ChallengeService implements IChallengeService {
  
  generateChallenge(item: IItem): string[] {
    const challenges: string[] = [];

    const addColorChallenge = () => challenges.push("What is the color of the item?");
    const addBrandChallenge = () => challenges.push("What is the brand/manufacturer?");
    const addContentChallenge = () => challenges.push("Describe 3 unique items inside.");
    const addFeatureChallenge = () => challenges.push("Describe any specific identifying marks (scratches, stickers).");
    const addPasswordChallenge = () => challenges.push("If this is an electronic device, can you provide the unlock code/password?");

    // Functional checks
    const hasColor = Boolean(item.color);
    const hasBrand = Boolean(item.brand);
    const isBag = item.category === 'BAGS';
    const hasFeatures = Boolean(item.identifyingFeatures && item.identifyingFeatures.length);
    const isElectronics = item.category === 'ELECTRONICS';

    // Strategy Maps for execution
    const checks = [
        { condition: hasColor, action: addColorChallenge },
        { condition: hasBrand, action: addBrandChallenge },
        { condition: isBag, action: addContentChallenge },
        { condition: hasFeatures, action: addFeatureChallenge },
        { condition: isElectronics, action: addPasswordChallenge }
    ];

    // Execute applicable strategies
    checks.forEach(check => {
        const strategy = {
            true: check.action,
            false: () => {}
        };
        strategy[String(check.condition) as keyof typeof strategy]();
    });

    return challenges;
  }

  verifyResponse(actualValue: string, userResponse: string): boolean {
    const normalize = (text: string) => text.toLowerCase().trim();
    const v1 = normalize(actualValue);
    const v2 = normalize(userResponse);

    // Fuzzy match logic
    // 1. Exact match
    const isExact = v1 === v2;
    // 2. Contains match
    const isContains = v1.includes(v2) || v2.includes(v1);
    
    // transform boolean to score logic map
    const scoreMap = {
        true: 1,
        false: 0
    };

    const exactScore = scoreMap[String(isExact) as keyof typeof scoreMap];
    const containsScore = scoreMap[String(isContains) as keyof typeof scoreMap];

    // Threshold check (simple OR equivalent)
    const isValid = Boolean(exactScore || containsScore);

    return isValid;
  }
}

export default new ChallengeService();
