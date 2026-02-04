import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Submission from '../models/Submission';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { upload } from '../utils/multerConfig';

const router = Router();

// @route   POST /api/submissions
// @desc    Create a new submission
// @access  Private (School role)
router.post(
  '/',
  [authMiddleware, roleMiddleware('school', 'admin')],
  upload.array('attachments', 5),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').isIn(['news', 'achievement', 'event', 'announcement', 'other']).withMessage('Invalid category'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { title, description, category, schoolId } = req.body;
      const files = req.files as Express.Multer.File[];

      const attachments = files ? files.map(file => file.path) : [];

      const submission = new Submission({
        schoolId: schoolId || req.user?.schoolId,
        title,
        description,
        category,
        attachments,
        status: 'submitted_school',
      });

      await submission.save();

      res.status(201).json({
        message: 'Submission created successfully',
        submission,
      });
    } catch (error: any) {
      console.error('Create submission error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/submissions
// @desc    Get all submissions
// @access  Private (Writer, Admin)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, schoolId } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (schoolId) filter.schoolId = schoolId;

    // If user is school role, only show their submissions
    if (req.user?.role === 'school' && req.user?.schoolId) {
      filter.schoolId = req.user.schoolId;
    }

    const submissions = await Submission.find(filter)
      .populate('schoolId', 'name city')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.json({ submissions });
  } catch (error: any) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/submissions/:id
// @desc    Get submission by ID
// @access  Private
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('schoolId')
      .populate('assignedTo', 'name email');

    if (!submission) {
      res.status(404).json({ message: 'Submission not found' });
      return;
    }

    res.json({ submission });
  } catch (error: any) {
    console.error('Get submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/submissions/:id
// @desc    Update submission
// @access  Private (Writer, Admin)
router.put(
  '/:id',
  [authMiddleware, roleMiddleware('writer', 'admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, assignedTo } = req.body;

      const submission = await Submission.findByIdAndUpdate(
        req.params.id,
        { status, assignedTo },
        { new: true, runValidators: true }
      );

      if (!submission) {
        res.status(404).json({ message: 'Submission not found' });
        return;
      }

      res.json({
        message: 'Submission updated successfully',
        submission,
      });
    } catch (error: any) {
      console.error('Update submission error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   DELETE /api/submissions/:id
// @desc    Delete submission
// @access  Private (Admin only)
router.delete(
  '/:id',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const submission = await Submission.findByIdAndDelete(req.params.id);
      if (!submission) {
        res.status(404).json({ message: 'Submission not found' });
        return;
      }

      res.json({ message: 'Submission deleted successfully' });
    } catch (error: any) {
      console.error('Delete submission error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

export default router;
