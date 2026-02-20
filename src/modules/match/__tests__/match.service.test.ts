import matchService from '../match.service';
import Match from '../match.model';
import Item from '../../item/item.model';
import LostReport from '../../lost-report/lost-report.model';
import Settings from '../../settings/settings.model';
import mongoose from 'mongoose';

// Mock mongoose models
jest.mock('../match.model');
jest.mock('../../item/item.model');
jest.mock('../../lost-report/lost-report.model');
jest.mock('../../settings/settings.model');
jest.mock('p-limit', () => () => (fn: () => Promise<unknown>) => fn());

// Mock mongoose sessions
const mockSession = {
  withTransaction: jest.fn().mockImplementation((cb) => cb()),
  endSession: jest.fn(),
};
jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as unknown as mongoose.ClientSession);

describe('MatchService', () => {
  const mockWeights = {
    category: 0.1,
    keyword: 0.1,
    date: 0.1,
    location: 0.1,
    feature: 0.45,
    color: 0.15,
  };

  const mockSettings = {
    autoMatchThreshold: 85,
    rejectThreshold: 30,
    matchWeights: mockWeights,
    save: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Settings.findOne as jest.Mock).mockResolvedValue(mockSettings);
  });

  describe('generateMatches', () => {
    it('should generate matches with high score for exact matches', async () => {
      const mockItem = {
        _id: 'item123',
        category: 'ELECTRONICS',
        keywords: ['iphone', 'black', '128gb'],
        dateFound: new Date('2024-01-01'),
        locationFound: 'Terminal 1',
        identifyingFeatures: ['scratch on screen'],
        status: 'AVAILABLE',
      };

      const mockReport = {
        _id: 'report123',
        category: 'ELECTRONICS',
        keywords: ['iphone', 'black'],
        dateLost: new Date('2024-01-01'),
        locationLost: 'Terminal 1',
        identifyingFeatures: ['scratch'],
        reportedBy: 'user1',
      };

      // Mock DB responses
      (LostReport.findById as jest.Mock).mockResolvedValue(mockReport);
      (Item.find as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue([mockItem]),
      });
      (Item.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
            session: jest.fn().mockResolvedValue(mockItem)
        })
      });
      (Match.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      (Match.create as jest.Mock).mockImplementation((data) => [{ ...data[0], _id: 'match1' }]);

      const matches = await matchService.generateMatches({ lostReportId: 'report123' });

      expect(matches).toHaveLength(1);
      expect(matches[0].confidenceScore).toBeGreaterThan(50); 
      expect(matches[0].itemId).toBe('item123');
    });
  });
});
