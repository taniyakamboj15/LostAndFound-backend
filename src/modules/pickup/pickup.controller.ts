import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, UserRole } from '../../common/types';
import pickupService from './pickup.service';
import { ForbiddenError } from '../../common/errors';

/**
 * @swagger
 * tags:
 *   name: Pickups
 *   description: Scheduled item retrieval management
 */
class PickupController {
  /**
   * @swagger
   * /api/pickups:
   *   post:
   *     summary: Book a pickup slot for a verified claim
   *     tags: [Pickups]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - claimId
   *               - pickupDate
   *               - startTime
   *               - endTime
   *             properties:
   *               claimId:
   *                 type: string
   *               pickupDate:
   *                 type: string
   *                 format: date
   *               startTime:
   *                 type: string
   *               endTime:
   *                 type: string
   *     responses:
   *       201:
   *         description: Pickup booked successfully
   */
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

  /**
   * @swagger
   * /api/pickups/slots:
   *   get:
   *     summary: Get available pickup slots for a specific date
   *     tags: [Pickups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: Available slots retrieved
   */
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

  /**
   * @swagger
   * /api/pickups/my:
   *   get:
   *     summary: Get pickups booked by the current user
   *     tags: [Pickups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: isCompleted
   *         schema:
   *           type: string
   *       - in: query
   *         name: pickupDate
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: User pickups retrieved successfully
   */
  getMyPickups = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 20, isCompleted, pickupDate } = req.query;

      const result = await pickupService.getMyPickups(req.user!.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      }, {
        isCompleted: isCompleted as string | undefined,
        pickupDate: pickupDate as string | undefined,
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

  /**
   * @swagger
   * /api/pickups/{id}:
   *   get:
   *     summary: Get pickup details by ID
   *     tags: [Pickups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Pickup details retrieved successfully
   */
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

  /**
   * @swagger
   * /api/pickups/{id}/complete:
   *   post:
   *     summary: Mark a pickup as completed (Staff/Admin only)
   *     tags: [Pickups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - referenceCode
   *             properties:
   *               referenceCode:
   *                 type: string
   *               notes:
   *                 type: string
   *     responses:
   *       200:
   *         description: Pickup completed successfully
   */
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

  /**
   * @swagger
   * /api/pickups/verify:
   *   post:
   *     summary: Verify a pickup reference code
   *     tags: [Pickups]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - referenceCode
   *             properties:
   *               referenceCode:
   *                 type: string
   *     responses:
   *       200:
   *         description: Reference code verified successfully
   */
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

  /**
   * @swagger
   * /api/pickups:
   *   get:
   *     summary: Get all pickups (Staff/Admin only)
   *     tags: [Pickups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: isCompleted
   *         schema:
   *           type: string
   *       - in: query
   *         name: pickupDate
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: All pickups retrieved successfully
   */
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
