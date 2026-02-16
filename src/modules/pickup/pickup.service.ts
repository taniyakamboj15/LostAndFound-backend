import QRCode from 'qrcode';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Pickup, { IPickup } from './pickup.model';

interface PickupFilters {
  isCompleted?: string;
  pickupDate?: string;
}
import Claim from '../claim/claim.model';
import Item from '../item/item.model';
import { ClaimStatus, ItemStatus, PickupSlot } from '../../common/types';
import { NotFoundError, ValidationError } from '../../common/errors';
import activityService from '../activity/activity.service';
import { ActivityAction } from '../../common/types';
import notificationService from '../notification/notification.service';
import { NotificationEvent } from '../../common/types';

class PickupService {
  private readonly SLOT_DURATION = parseInt(
    process.env.PICKUP_SLOT_DURATION_MINUTES || '30'
  );

  async bookPickup(data: {
    claimId: string;
    claimantId: string;
    pickupDate: Date;
    startTime: string;
    endTime: string;
  }): Promise<IPickup> {
    // Verify claim
    const claim = await Claim.findOne({
      _id: data.claimId,
      claimantId: data.claimantId,
      status: ClaimStatus.VERIFIED,
    });

    if (!claim) {
      throw new NotFoundError('Verified claim not found');
    }

    // Check if pickup already exists
    const existingPickup = await Pickup.findOne({ claimId: data.claimId });
    if (existingPickup) {
      throw new ValidationError('Pickup already booked for this claim');
    }

    // Generate QR code and reference code
    const referenceCode = this.generateReferenceCode();
    const qrCodeData = JSON.stringify({
      claimId: data.claimId,
      referenceCode,
      pickupDate: data.pickupDate,
    });
    const qrCode = await QRCode.toDataURL(qrCodeData);

    const pickup = await Pickup.create({
      ...data,
      itemId: claim.itemId,
      qrCode,
      referenceCode,
    });

    // Update claim status
    claim.status = ClaimStatus.PICKUP_BOOKED;
    await claim.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.PICKUP_BOOKED,
      userId: data.claimantId,
      entityType: 'Pickup',
      entityId: pickup._id.toString(),
      metadata: {
        pickupDate: data.pickupDate,
        referenceCode,
      },
    });

    // Schedule pickup reminder (24 hours before)
    const reminderDate = new Date(data.pickupDate);
    reminderDate.setHours(reminderDate.getHours() - 24);

    if (reminderDate > new Date()) {
      await notificationService.queueNotification({
        event: NotificationEvent.PICKUP_REMINDER,
        userId: data.claimantId,
        data: {
          pickupId: pickup._id.toString(),
          pickupDate: data.pickupDate,
          startTime: data.startTime,
          endTime: data.endTime,
          referenceCode,
        },
      });
    }

    return pickup;
  }

  async getAvailableSlots(date: Date): Promise<PickupSlot[]> {
    const slots: PickupSlot[] = [];
    const startHour = 9; // 9 AM
    const endHour = 17; // 5 PM

    for (let hour = startHour; hour < endHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endHour = hour;
      const endMinute = this.SLOT_DURATION;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      // Check if slot is available
      const existingPickup = await Pickup.findOne({
        pickupDate: date,
        startTime,
        isCompleted: false,
      });

      slots.push({
        date,
        startTime,
        endTime,
        available: !existingPickup,
      });
    }

    return slots;
  }

  async getPickupById(pickupId: string): Promise<IPickup> {
    const pickup = await Pickup.findById(pickupId)
      .populate('claimId')
      .populate('itemId')
      .populate('claimantId', 'name email phone')
      .populate('completedBy', 'name email');

    if (!pickup) {
      throw new NotFoundError('Pickup not found');
    }

    return pickup;
  }

  async getMyPickups(
    userId: string,
    pagination: { page: number; limit: number }
  ): Promise<{ data: IPickup[]; total: number }> {
    const total = await Pickup.countDocuments({ claimantId: userId });

    const pickups = await Pickup.find({ claimantId: userId })
      .sort({ pickupDate: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('itemId')
      .populate('claimId');

    return { data: pickups, total };
  }

  async completePickup(
    pickupId: string,
    staffId: string,
    referenceCode: string,
    notes?: string
  ): Promise<IPickup> {
    const pickup = await Pickup.findById(pickupId).populate('claimId');

    if (!pickup) {
      throw new NotFoundError('Pickup not found');
    }

    if (pickup.referenceCode !== referenceCode) {
      throw new ValidationError('Invalid reference code');
    }

    if (pickup.isCompleted) {
      throw new ValidationError('Pickup already completed');
    }

    pickup.isCompleted = true;
    pickup.completedAt = new Date();
    pickup.completedBy = staffId as never;
    pickup.notes = notes;
    await pickup.save();

    // Update claim status
    const claim = await Claim.findById(pickup.claimId);
    if (claim) {
      claim.status = ClaimStatus.RETURNED;
      await claim.save();
    }

    // Update item status
    const item = await Item.findById(pickup.itemId);
    if (item) {
      item.status = ItemStatus.RETURNED;
      await item.save();
    }

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.PICKUP_COMPLETED,
      userId: staffId,
      entityType: 'Pickup',
      entityId: pickupId,
      metadata: {
        claimantId: pickup.claimantId.toString(),
        itemId: pickup.itemId.toString(),
      },
    });

    return pickup;
  }

  async verifyReferenceCode(
    pickupId: string,
    referenceCode: string
  ): Promise<boolean> {
    const pickup = await Pickup.findById(pickupId);

    if (!pickup) {
      return false;
    }

    return pickup.referenceCode === referenceCode;
  }

  async getAllPickups(
    pagination: { page: number; limit: number },
    filters: PickupFilters = {}
  ): Promise<{ data: IPickup[]; total: number }> {
    const query: mongoose.FilterQuery<IPickup> = {};

    if (filters.isCompleted !== undefined) {
      query.isCompleted = filters.isCompleted === 'true';
    }

    if (filters.pickupDate) {
      query.pickupDate = new Date(filters.pickupDate);
    }

    const total = await Pickup.countDocuments(query);

    const pickups = await Pickup.find(query)
      .sort({ pickupDate: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('itemId')
      .populate('claimId')
      .populate('claimantId', 'name email phone');

    return { data: pickups, total };
  }

  private generateReferenceCode(): string {
    return uuidv4().substring(0, 8).toUpperCase();
  }
}

export default new PickupService();
