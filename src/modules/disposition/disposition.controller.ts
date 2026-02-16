import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import dispositionService from './disposition.service';

class DispositionController {
  createDisposition = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { itemId, type, recipient, notes } = req.body;

      const disposition = await dispositionService.createDisposition({
        itemId,
        type,
        processedBy: req.user!.id,
        recipient,
        notes,
      });

      res.status(201).json({
        success: true,
        message: 'Disposition created successfully',
        data: disposition,
      });
    }
  );

  getAllDispositions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { type, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

      const result = await dispositionService.getAllDispositions(
        {
          type: type as never,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
        },
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
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

  getDispositionById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const disposition = await dispositionService.getDispositionById(req.params.id);

      res.json({
        success: true,
        data: disposition,
      });
    }
  );

  getExpiredItems = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const items = await dispositionService.getExpiredItems();

      res.json({
        success: true,
        data: items,
      });
    }
  );

  addAuditEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { action, details } = req.body;

      const disposition = await dispositionService.addAuditEntry(
        req.params.id,
        req.user!.id,
        action,
        details
      );

      res.json({
        success: true,
        message: 'Audit entry added',
        data: disposition,
      });
    }
  );
}

export default new DispositionController();
