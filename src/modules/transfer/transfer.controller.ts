import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../common/types';
import transferService from './transfer.service';
import { TransferStatus } from '../../common/types';
import { ValidationError, NotFoundError } from '../../common/errors';

class TransferController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 10, ...filters } = req.query;
      const result = await transferService.getTransfers(filters, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      res.json({ 
        success: true, 
        data: result.data, 
        pagination: result.pagination 
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const transfer = await transferService.getTransferById(req.params.id);
      if (!transfer) throw new NotFoundError('Transfer not found');
      res.json({ success: true, data: transfer });
    } catch (error) {
      next(error);
    }
  }

  async getByClaim(req: Request, res: Response, next: NextFunction) {
    try {
      const transfer = await transferService.getTransferByClaimId(req.params.claimId);
      if (!transfer) throw new NotFoundError('Transfer not found for this claim');
      res.json({ success: true, data: transfer });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, carrierInfo, notes } = req.body;
      
      const allowedStatuses = new Set([
        TransferStatus.PENDING,
        TransferStatus.IN_TRANSIT,
        TransferStatus.ARRIVED,
        TransferStatus.CANCELLED
      ]);

      if (!allowedStatuses.has(status)) {
        throw new ValidationError('Invalid transfer status');
      }

      const authUser = (req as AuthenticatedRequest).user;
      const updatedById = authUser?.id || authUser?._id || '';

      const transfer = await transferService.updateTransferStatus(
        req.params.id,
        status,
        {
          updatedBy: updatedById.toString(),
          carrierInfo,
          notes
        }
      );

      res.json({ success: true, data: transfer, message: `Transfer marked as ${status.toLowerCase()}` });
    } catch (error) {
      next(error);
    }
  }
}

export default new TransferController();
