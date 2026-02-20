import { Router } from 'express';
import storageController from './storage.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import {
  createStorageValidation,
  updateStorageValidation,
  getAllStorageValidation,
  storageIdValidation,
} from './storage.validation';
import { UserRole } from '../../common/types';

const router = Router();



// Public cities and pickup points for all authenticated users
router.get('/pickup-points', storageController.getPickupPoints);
router.get('/cities', storageController.getUniqueCities);


router.use(authenticate);
// Restricted storage management
router.use(requireRole(UserRole.STAFF, UserRole.ADMIN));

router.post(
  '/',
  validate(createStorageValidation),
  storageController.createStorage
);


router.get(
  '/',
  validate(getAllStorageValidation),
  storageController.getAllStorage
);


router.get('/available', storageController.getAvailableStorage);

router.get('/overflow-suggestions', requireRole(UserRole.ADMIN), storageController.getOverflowSuggestions);

router.get(
  '/:id',
  validate(storageIdValidation),
  storageController.getStorageById
);

router.patch(
  '/:id',
  validate(updateStorageValidation),
  storageController.updateStorage
);

router.delete(
  '/:id',
  validate(storageIdValidation),
  storageController.deleteStorage
);

export default router;
