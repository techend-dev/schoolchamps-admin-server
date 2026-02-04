import { Router, Response } from 'express';
import School from '../models/School';
import Submission from '../models/Submission';
import Blog from '../models/Blog';
import User from '../models/User';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// @route   GET /api/admin/overview
// @desc    Get admin dashboard overview
// @access  Private (Admin only)
router.get(
  '/overview',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const totalSchools = await School.countDocuments({ isActive: true });
      const totalSubmissions = await Submission.countDocuments();
      const totalPublished = await Blog.countDocuments({ status: 'published_wp' });
      const draftsPending = await Blog.countDocuments({ status: 'draft_created' });
      const blogsInReview = await Blog.countDocuments({ status: 'review' });

      // Get top schools by number of submissions
      const topSchools = await Submission.aggregate([
        {
          $group: {
            _id: '$schoolId',
            submissionCount: { $sum: 1 },
          },
        },
        {
          $sort: { submissionCount: -1 },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: 'schools',
            localField: '_id',
            foreignField: '_id',
            as: 'school',
          },
        },
        {
          $unwind: '$school',
        },
        {
          $project: {
            _id: 1,
            submissionCount: 1,
            'school.name': 1,
            'school.city': 1,
          },
        },
      ]);

      // Recent submissions
      const recentSubmissions = await Submission.find()
        .populate('schoolId', 'name city')
        .sort({ createdAt: -1 })
        .limit(10);

      // Recent published blogs
      const recentPublished = await Blog.find({ status: 'published_wp' })
        .populate('submissionId')
        .populate('assignedSchool', 'name')
        .sort({ publishedAt: -1 })
        .limit(10);

      res.json({
        overview: {
          totalSchools,
          totalSubmissions,
          totalPublished,
          draftsPending,
          blogsInReview,
        },
        topSchools,
        recentSubmissions,
        recentPublished,
      });
    } catch (error: any) {
      console.error('Get admin overview error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/admin/blogs
// @desc    Get all blogs for admin
// @access  Private (Admin only)
router.get(
  '/blogs',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const blogs = await Blog.find()
        .populate('submissionId')
        .populate('createdBy', 'name email')
        .populate('assignedSchool', 'name city')
        .sort({ createdAt: -1 });

      res.json({ blogs });
    } catch (error: any) {
      console.error('Get admin blogs error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/admin/blogs/:id/status
// @desc    Update blog status
// @access  Private (Admin only)
router.put(
  '/blogs/:id/status',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.body;

      if (!['draft_created', 'review', 'published_wp'].includes(status)) {
        res.status(400).json({ message: 'Invalid status' });
        return;
      }

      const blog = await Blog.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );

      if (!blog) {
        res.status(404).json({ message: 'Blog not found' });
        return;
      }

      res.json({
        message: 'Blog status updated successfully',
        blog,
      });
    } catch (error: any) {
      console.error('Update blog status error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin only)
router.get(
  '/users',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const users = await User.find()
        .select('-password')
        .populate('schoolId', 'name city')
        .sort({ createdAt: -1 });

      res.json({ users });
    } catch (error: any) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/admin/users/:id/toggle-active
// @desc    Toggle user active status
// @access  Private (Admin only)
router.put(
  '/users/:id/toggle-active',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      user.isActive = !user.isActive;
      await user.save();

      res.json({
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
        },
      });
    } catch (error: any) {
      console.error('Toggle user active error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

export default router;
