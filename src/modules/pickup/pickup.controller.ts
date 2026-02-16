import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, UserRole } from '../../common/types';
import pickupService from './pickup.service';
import { ForbiddenError } from '../../common/errors';

class PickupController {
  bookPickup = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { claimId, pickupDate, startTime, endTime } = req.body;

      const pickup = await pickupService.bookPickup({
        claimId,
        claimantId: req.user!.id,
        pickupDate: new Date(pickupDate),
        startTime,
        endTime,
      });

      res.status(201).json({
        success: true,
        message: 'Pickup booked successfully',
        data: pickup,
      });
    }
  );

  getAvailableSlots = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { date } = req.query;

      const slots = await pickupService.getAvailableSlots(new Date(date as string));

      res.json({
        success: true,
        data: slots,
      });
    }
  );

  getMyPickups = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 20 } = req.query;

      const result = await pickupService.getMyPickups(req.user!.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      const pickups = result.data.map(pickup => {
        const pickupObj = pickup.toObject();
        if (req.user!.role === UserRole.STAFF) {
          const { referenceCode, qrCode, ...safePickup } = pickupObj;
          return safePickup;
        }
        return pickupObj;
      });

      res.json({
        success: true,
        data: pickups,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string)),
        },
      });
    }
  );

  getPickupById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const pickup = await pickupService.getPickupById(req.params.id);

      // Access control
      const isStaffOrAdmin = [UserRole.STAFF, UserRole.ADMIN].includes(
        req.user!.role as UserRole
      );
      const isClaimant = pickup.claimantId._id.toString() === req.user!.id;

      if (!isStaffOrAdmin && !isClaimant) {
        throw new ForbiddenError('You do not have permission to view this pickup');
      }

      const pickupObj = pickup.toObject();
     
      let responseData: Record<string, unknown> = pickupObj as unknown as Record<string, unknown>;

      // Hide sensitive data for Staff (unless Admin)
      if (req.user!.role === UserRole.STAFF) {
        const { referenceCode, qrCode, ...safePickup } = pickupObj;
        responseData = safePickup;
      }

      res.json({
        success: true,
        data: responseData,
      });
    }
  );

  completePickup = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { referenceCode, notes } = req.body;

      const pickup = await pickupService.completePickup(
        req.params.id,
        req.user!.id,
        referenceCode,
        notes
      );

      res.json({
        success: true,
        message: 'Pickup completed successfully',
        data: pickup,
      });
    }
  );

    verifyReference = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { referenceCode } = req.body;

      const pickup = await pickupService.verifyReferenceCode(referenceCode);

      res.json({
        success: true,
        message: 'Pickup verified successfully',
        data: pickup,
      });
    }
  );

  getAllPickups = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 20, isCompleted, pickupDate } = req.query;

      const result = await pickupService.getAllPickups(
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        },
        {
          isCompleted: isCompleted as string | undefined,
          pickupDate: pickupDate as string | undefined,
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string)),
        },
      });
    }
  );
}

export default new PickupController();
