import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import School from '../models/School';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// @route   POST /api/schools
// @desc    Create a new school
// @access  Private (Admin only)
router.post(
  '/',
  [authMiddleware, roleMiddleware('admin')],
  [
    body('name').trim().notEmpty().withMessage('School name is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('pincode').trim().notEmpty().withMessage('Pincode is required'),
    body('contactEmail').isEmail().withMessage('Valid email is required'),
    body('contactPhone').trim().notEmpty().withMessage('Phone is required'),
    body('principalName').trim().notEmpty().withMessage('Principal name is required'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const school = new School(req.body);
      await school.save();

      res.status(201).json({
        message: 'School created successfully',
        school,
      });
    } catch (error: any) {
      console.error('Create school error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/schools
// @desc    Get all schools
// @access  Private
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schools = await School.find().sort({ createdAt: -1 });
    res.json({ schools });
  } catch (error: any) {
    console.error('Get schools error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/schools/:id
// @desc    Get school by ID
// @access  Private
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      res.status(404).json({ message: 'School not found' });
      return;
    }

    res.json({ school });
  } catch (error: any) {
    console.error('Get school error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/schools/:id
// @desc    Update school
// @access  Private (Admin only)
router.put(
  '/:id',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const school = await School.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!school) {
        res.status(404).json({ message: 'School not found' });
        return;
      }

      res.json({
        message: 'School updated successfully',
        school,
      });
    } catch (error: any) {
      console.error('Update school error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   DELETE /api/schools/:id
// @desc    Delete school
// @access  Private (Admin only)
router.delete(
  '/:id',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const school = await School.findByIdAndDelete(req.params.id);
      if (!school) {
        res.status(404).json({ message: 'School not found' });
        return;
      }

      res.json({ message: 'School deleted successfully' });
    } catch (error: any) {
      console.error('Delete school error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

export default router;
