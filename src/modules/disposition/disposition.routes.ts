import { Router } from 'express';
import dispositionController from './disposition.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import {
  createDispositionValidation,
  getAllDispositionsValidation,
  addAuditEntryValidation,
  dispositionIdValidation,
} from './disposition.validation';
import { UserRole } from '../../common/types';

const router = Router();

// All routes require authentication and Admin role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

// Create disposition
router.post(
  '/',
  validate(createDispositionValidation),
  dispositionController.createDisposition
);

// Get all dispositions
router.get(
  '/',
  validate(getAllDispositionsValidation),
  dispositionController.getAllDispositions
);

// Get expired items
router.get('/expired-items', dispositionController.getExpiredItems);

// Get disposition by ID
router.get(
  '/:id',
  validate(dispositionIdValidation),
  dispositionController.getDispositionById
);

// Add audit entry
router.post(
  '/:id/audit',
  validate(addAuditEntryValidation),
  dispositionController.addAuditEntry
);

export default router;
