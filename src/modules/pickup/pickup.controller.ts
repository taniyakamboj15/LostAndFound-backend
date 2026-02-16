import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import pickupService from './pickup.service';

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

  getPickupById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const pickup = await pickupService.getPickupById(req.params.id);

      res.json({
        success: true,
        data: pickup,
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

      const isValid = await pickupService.verifyReferenceCode(
        req.params.id,
        referenceCode
      );

      res.json({
        success: true,
        data: { isValid },
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
        { isCompleted, pickupDate }
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
