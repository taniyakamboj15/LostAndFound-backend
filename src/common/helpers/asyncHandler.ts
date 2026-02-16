import { Request, Response, NextFunction, RequestHandler } from 'express';


type AsyncFunction<ReqType = Request> = (
  req: ReqType,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler<ReqType extends Request = Request>(
  fn: AsyncFunction<ReqType>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as ReqType, res, next)).catch(next);
  };
}
