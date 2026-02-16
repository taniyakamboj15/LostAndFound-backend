import { Router } from 'express';
import itemController from './item.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import {
  createItemValidation,
  updateItemStatusValidation,
  searchItemsValidation,
  assignStorageValidation,
} from './item.validation';
import { UserRole } from '../../common/types';
import { strictLimiter } from '../../common/middlewares/rateLimit.middleware';
import { uploadArray } from '../../common/middlewares/multer.middleware';

const router = Router();

// Public Search (No Auth)
router.get(
  '/public/search',
  strictLimiter,
  itemController.searchPublicItems
);

// All other routes require authentication
router.use(authenticate);

// Create item (Staff/Admin)
router.post(
  '/',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  uploadArray('photos'),
  validate(createItemValidation),
  itemController.createItem
);

// Search items (Staff/Admin)
router.get(
  '/',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(searchItemsValidation),
  itemController.getItems
);



// Get item by ID
router.get('/:id', itemController.getItemById);

// Update item status (Staff/Admin)
router.patch(
  '/:id/status',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(updateItemStatusValidation),
  itemController.updateItemStatus
);

// Assign storage (Staff/Admin)
router.patch(
  '/:id/storage',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(assignStorageValidation),
  itemController.assignStorage
);

export default router;
