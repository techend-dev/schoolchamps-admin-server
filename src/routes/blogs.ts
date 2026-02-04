import { Router, Response } from 'express';
import Blog from '../models/Blog';
import Submission from '../models/Submission';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { body, validationResult } from 'express-validator';

const router = Router();

// @route   GET /api/blogs
// @desc    Get all blogs
// @access  Private
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, schoolId } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (schoolId) filter.assignedSchool = schoolId;

    // If user is school role, only show their blogs
    if (req.user?.role === 'school' && req.user?.schoolId) {
      filter.assignedSchool = req.user.schoolId;
    }

    const blogs = await Blog.find(filter)
      .populate('submissionId')
      .populate('createdBy', 'name email')
      .populate('assignedSchool', 'name city')
      .sort({ createdAt: -1 });

    res.json({ blogs });
  } catch (error: any) {
    console.error('Get blogs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/blogs/:id
// @desc    Get blog by ID
// @access  Private
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('submissionId')
      .populate('createdBy', 'name email')
      .populate('assignedSchool', 'name city');

    if (!blog) {
      res.status(404).json({ message: 'Blog not found' });
      return;
    }

    res.json({ blog });
  } catch (error: any) {
    console.error('Get blog error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/blogs/:id
// @desc    Update blog
// @access  Private (Writer, Admin, School with assigned blog)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      res.status(404).json({ message: 'Blog not found' });
      return;
    }

    // Check permissions
    const canEdit =
      req.user?.role === 'admin' ||
      req.user?.role === 'writer' ||
      (req.user?.role === 'school' && blog.assignedSchool?.toString() === req.user?.schoolId);

    if (!canEdit) {
      res.status(403).json({ message: 'Not authorized to edit this blog' });
      return;
    }

    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      message: 'Blog updated successfully',
      blog: updatedBlog,
    });
  } catch (error: any) {
    console.error('Update blog error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/blogs/assign/:schoolId/:id
// @desc    Assign blog to school for review
// @access  Private (Writer, Admin)
router.post(
  '/assign/:schoolId/:id',
  [authMiddleware, roleMiddleware('writer', 'admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const blog = await Blog.findById(req.params.id);

      if (!blog) {
        res.status(404).json({ message: 'Blog not found' });
        return;
      }

      blog.assignedSchool = req.params.schoolId as any;
      blog.status = 'review';
      await blog.save();

      res.json({
        message: 'Blog assigned to school for review',
        blog,
      });
    } catch (error: any) {
      console.error('Assign blog error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   PUT /api/blogs/review/:id
// @desc    School reviews and updates blog
// @access  Private (School, Admin)
router.put(
  '/review/:id',
  [authMiddleware, roleMiddleware('school', 'admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const blog = await Blog.findById(req.params.id);

      if (!blog) {
        res.status(404).json({ message: 'Blog not found' });
        return;
      }

      // Verify school owns this blog
      if (req.user?.role === 'school' && blog.assignedSchool?.toString() !== req.user?.schoolId) {
        res.status(403).json({ message: 'Not authorized to review this blog' });
        return;
      }

      const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });

      res.json({
        message: 'Blog review saved successfully',
        blog: updatedBlog,
      });
    } catch (error: any) {
      console.error('Review blog error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   DELETE /api/blogs/:id
// @desc    Delete blog
// @access  Private (Admin only)
router.delete(
  '/:id',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const blog = await Blog.findByIdAndDelete(req.params.id);

      if (!blog) {
        res.status(404).json({ message: 'Blog not found' });
        return;
      }

      res.json({ message: 'Blog deleted successfully' });
    } catch (error: any) {
      console.error('Delete blog error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

export default router;
