/**
 * Payment Authorization Middleware
 *
 * Enforces that the authenticated user is the verified claimant of the claim
 * they are attempting to pay for. This prevents one user paying for another
 * user's claim, or paying for a claim that has not yet been verified.
 *
 * Must be placed AFTER `authenticate` in the middleware chain.
 */
import { Response, NextFunction } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import { ClaimStatus, PaymentStatus } from '../../common/types';
import Claim from '../claim/claim.model';
import { NotFoundError, AuthorizationError, ValidationError } from '../../common/errors';

/**
 * Resolves the claim ID from either:
 *  - `req.params.claimId` (GET routes)
 *  - `req.body.claimId`   (POST routes)
 *
 * Then asserts:
 *  1. The claim exists
 *  2. `req.user.id` is the claimant of that claim
 *  3. The claim's status is VERIFIED (payment is only allowed post-verification)
 *  4. The claim has not already been paid (prevents duplicate intent creation)
 */
export const requireOwnVerifiedClaim = asyncHandler(async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const claimId: string | undefined = req.params.claimId ?? req.body.claimId;

  if (!claimId) {
    return next(new ValidationError('claimId is required'));
  }

  const claim = await Claim.findById(claimId).select('claimantId status paymentStatus').lean();

  if (!claim) {
    return next(new NotFoundError('Claim not found'));
  }

  if (claim.claimantId.toString() !== req.user!.id) {
    return next(new AuthorizationError('You are not the claimant of this claim'));
  }

  if (claim.status !== ClaimStatus.VERIFIED) {
    return next(
      new ValidationError(
        `Payment is only allowed for verified claims (current status: ${claim.status})`
      )
    );
  }

  
  if (
    claim.paymentStatus === PaymentStatus.PAID &&
    req.path.endsWith('/create-intent')
  ) {
    return next(new ValidationError('This claim has already been paid'));
  }

  next();
});
