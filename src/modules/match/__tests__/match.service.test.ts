import matchService from '../match.service';
import Match from '../match.model';
import Item from '../../item/item.model';
import LostReport from '../../lost-report/lost-report.model';

// Mock mongoose models
jest.mock('../match.model');
jest.mock('../../item/item.model');
jest.mock('../../lost-report/lost-report.model');

describe('MatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      (Item.find as jest.Mock).mockResolvedValue([mockItem]);
      (Match.findOne as jest.Mock).mockResolvedValue(null);
      (Match.create as jest.Mock).mockImplementation((data) => ({ ...data, _id: 'match1' }));

      const matches = await matchService.generateMatches({ lostReportId: 'report123' });

      expect(matches).toHaveLength(1);
      expect(matches[0].confidenceScore).toBeGreaterThan(0.5); // Adjusted threshold
      expect(matches[0].itemId).toBe('item123');
      expect(matches[0].lostReportId).toBe('report123');
    });

    it('should not generate match if score is below threshold', async () => {
       const mockItem = {
        _id: 'item123',
        category: 'ELECTRONICS',
        keywords: ['laptop', 'dell'], // Different keywords
        dateFound: new Date('2024-02-01'), // Different date
        locationFound: 'Cafeteria', // Different location
        status: 'AVAILABLE',
      };

      const mockReport = {
        _id: 'report123',
        category: 'ELECTRONICS',
        keywords: ['iphone'], 
        dateLost: new Date('2024-01-01'),
        locationLost: 'Terminal 1',
        reportedBy: 'user1',
      };

      (LostReport.findById as jest.Mock).mockResolvedValue(mockReport);
      (Item.find as jest.Mock).mockResolvedValue([mockItem]);

      const matches = await matchService.generateMatches({ lostReportId: 'report123' });

      expect(matches).toHaveLength(0);
    });
  });
});
