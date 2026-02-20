import mongoose from 'mongoose';
import { IStorageModel, ItemSize } from '../../common/types';

interface ScoredItem {
    _id: string | mongoose.Types.ObjectId;
    highestConfidence: number;
    retentionExpiryDate: Date | string;
}

class StorageLogic {
    
    checkCapacity(storage: IStorageModel, size: ItemSize = ItemSize.MEDIUM): boolean {
        const sizeKey = size.toLowerCase() as keyof typeof storage.capacity;
        return storage.currentCount[sizeKey] < storage.capacity[sizeKey];
    }


    suggestOverflowItems(items: ScoredItem[]): string[] {
   
        const now = Date.now();
        
        const scoredItems = items.map(item => {
            const matchProb = item.highestConfidence || 0;
            const expiryDate = new Date(item.retentionExpiryDate).getTime();
            const daysRemaining = Math.max(0, (expiryDate - now) / (1000 * 60 * 60 * 24));
            const score = (100 - matchProb) * daysRemaining;
            
            return {
                id: item._id.toString(),
                score
            };
        });

        const sorted = scoredItems.sort((a, b) => b.score - a.score);

        const moveCount = Math.ceil(items.length * 0.2);
        
        return sorted.slice(0, moveCount).map(i => i.id);
    }

    getStorageStatus(storage: IStorageModel, size?: ItemSize): 'AVAILABLE' | 'FULL' | 'CRITICAL' {
        if (size) {
            const sizeKey = size.toLowerCase() as keyof typeof storage.capacity;
            const ratio = storage.currentCount[sizeKey] / (storage.capacity[sizeKey] || 1);
            return this.calculateStatus(ratio);
        }


        const ratios = [
            storage.currentCount.small / (storage.capacity.small || 1),
            storage.currentCount.medium / (storage.capacity.medium || 1),
            storage.currentCount.large / (storage.capacity.large || 1)
        ];
        
        const maxRatio = Math.max(...ratios);
        return this.calculateStatus(maxRatio);
    }

    private calculateStatus(ratio: number): 'AVAILABLE' | 'FULL' | 'CRITICAL' {
        if (ratio >= 1) return 'FULL';
        if (ratio >= 0.8) return 'CRITICAL';
        return 'AVAILABLE';
    }
}

export default new StorageLogic();
