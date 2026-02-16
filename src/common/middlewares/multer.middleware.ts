import { Request, Response, NextFunction } from 'express';
import { upload } from '../utils/upload';
import { MulterRequest } from '../types';
import { MulterError } from 'multer';

export const uploadArray = (fieldName: string, maxCount: number = 5) => {
  const multerUpload = upload.array(fieldName, maxCount);

  return (req: Request, res: Response, next: NextFunction) => {
    multerUpload(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof MulterError) {
          return next(err);
        }
        return next(err);
      }
      

      if (req.files) {
        (req as unknown as MulterRequest).files = req.files as Express.Multer.File[];
      }
      
      next();
    });
  };
};
