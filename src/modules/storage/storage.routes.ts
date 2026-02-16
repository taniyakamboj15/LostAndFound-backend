import { Router } from 'express';
import storageController from './storage.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import {
  createStorageValidation,
  updateStorageValidation,
  getAllStorageValidation,
} from './storage.validation';
import { UserRole } from '../../common/types';

const router = Router();

// All routes require authentication and Staff/Admin role
router.use(authenticate);
router.use(requireRole(UserRole.STAFF, UserRole.ADMIN));

// Create storage location
router.post(
  '/',
  validate(createStorageValidation),
  storageController.createStorage
);

// Get all storage locations
router.get(
  '/',
  validate(getAllStorageValidation),
  storageController.getAllStorage
);

// Get available storage
router.get('/available', storageController.getAvailableStorage);

// Get storage by ID
router.get('/:id', storageController.getStorageById);

// Update storage
router.patch(
  '/:id',
  validate(updateStorageValidation),
  storageController.updateStorage
);

// Delete storage
router.delete('/:id', storageController.deleteStorage);

export default router;
