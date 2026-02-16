import { Request, Response, NextFunction } from 'express';
import { upload } from '../utils/upload';
import { MulterRequest } from '../types';

export const uploadArray = (fieldName: string, maxCount: number = 5) => {
  const multerUpload = upload.array(fieldName, maxCount);

  return (req: Request, res: Response, next: NextFunction) => {
    multerUpload(req, res, (err: any) => {
      if (err) {
        return next(err);
      }
      
      // Ensure files are attached to req as expected by controller
      if (req.files) {
        (req as unknown as MulterRequest).files = req.files as any;
      }
      
      next();
    });
  };
};
