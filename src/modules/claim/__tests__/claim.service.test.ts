import claimService from '../claim.service';
import Claim from '../claim.model';
import Item from '../../item/item.model';
import activityService from '../../activity/activity.service';
import notificationService from '../../notification/notification.service';
import { ClaimStatus, ItemStatus } from '../../../common/types';

// Mock dependencies
jest.mock('../claim.model');
jest.mock('../../item/item.model');
jest.mock('../../user/user.model');
jest.mock('../../activity/activity.service');
jest.mock('../../notification/notification.service');

describe('ClaimService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createClaim', () => {
        it('should create a claim and update item status', async () => {
             const mockData = {
                itemId: 'item123',
                claimantId: 'user123',
                description: 'My lost item',
             };

             const mockItem = {
                 _id: 'item123',
                 status: ItemStatus.AVAILABLE,
                 save: jest.fn(),
             };

             const mockClaim = {
                 _id: 'claim123',
                 ...mockData,
                 status: ClaimStatus.FILED,
                 save: jest.fn(), // for requestProof
                 claimantId: 'user123',
             };

             (Item.findById as jest.Mock).mockResolvedValue(mockItem);
             (Claim.findOne as jest.Mock).mockResolvedValue(null); // No existing claim
             (Claim.create as jest.Mock).mockResolvedValue(mockClaim);
             (Claim.findById as jest.Mock).mockResolvedValue(mockClaim); // For requestProof
             (activityService.logActivity as jest.Mock).mockResolvedValue({});
             (notificationService.queueNotification as jest.Mock).mockResolvedValue({});

             const result = await claimService.createClaim(mockData);

             expect(Item.findById).toHaveBeenCalledWith('item123');
             expect(Claim.create).toHaveBeenCalled();
             expect(mockItem.status).toBe(ItemStatus.CLAIMED);
             expect(mockItem.save).toHaveBeenCalled();
             expect(activityService.logActivity).toHaveBeenCalled();
             expect(result).toHaveProperty('_id', 'claim123');
        });

        it('should throw error if item not available', async () => {
            const mockItem = {
                 _id: 'item123',
                 status: ItemStatus.CLAIMED,
             };
             (Item.findById as jest.Mock).mockResolvedValue(mockItem);

             await expect(claimService.createClaim({ itemId: 'item123', claimantId: 'u1', description: 'd' }))
                .rejects.toThrow('Item is not available for claiming');
        });
    });

    describe('verifyClaim', () => {
        it('should verify claim and notify user', async () => {
             const mockClaim = {
                 _id: 'claim123',
                 status: ClaimStatus.IDENTITY_PROOF_REQUESTED,
                 proofDocuments: [{ path: 'doc.jpg' }],
                 save: jest.fn(),
                 claimantId: 'user123',
                 verifiedBy: undefined, // Initialize
             };

             (Claim.findById as jest.Mock).mockResolvedValue(mockClaim);
             (activityService.logActivity as jest.Mock).mockResolvedValue({});
             (notificationService.queueNotification as jest.Mock).mockResolvedValue({});

             await claimService.verifyClaim('claim123', 'admin1', 'Looks good');

             expect(mockClaim.status).toBe(ClaimStatus.VERIFIED);
             expect(mockClaim.verifiedBy).toBe('admin1');
             expect(mockClaim.save).toHaveBeenCalled();
             expect(notificationService.queueNotification).toHaveBeenCalled();
        });
    });
});
