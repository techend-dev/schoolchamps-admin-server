import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import School from '../models/School';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['admin', 'writer', 'school', 'marketer']).withMessage('Invalid role'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, email, password, role, schoolId, schoolName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ message: 'User already exists with this email' });
        return;
      }

      let finalSchoolId = schoolId;

      // If role is school, create school if schoolName provided or verify existing schoolId
      if (role === 'school') {
        if (schoolName && !schoolId) {
          // Create new school
          const newSchool = new School({
            name: schoolName,
            contactEmail: email,
            isActive: true,
          });
          const savedSchool = await newSchool.save();
          finalSchoolId = savedSchool._id;
        } else if (schoolId) {
          // Verify existing school
          const school = await School.findById(schoolId);
          if (!school) {
            res.status(400).json({ message: 'Invalid school ID' });
            return;
          }
        } else {
          res.status(400).json({ message: 'School name is required for school users' });
          return;
        }
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user object
      const userData: any = {
        name,
        email,
        password: hashedPassword,
        role,
      };

      // Only include schoolId if role is school
      if (role === 'school' && finalSchoolId) {
        userData.schoolId = finalSchoolId;
      }

      const user = new User(userData);
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user._id, 
          role: user.role, 
          email: user.email,
          schoolId: user.schoolId 
        },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
        },
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email }).populate('schoolId');
      if (!user) {
        res.status(400).json({ message: 'Invalid credentials' });
        return;
      }

      // Check if user is active
      if (!user.isActive) {
        res.status(403).json({ message: 'Account is inactive. Please contact administrator.' });
        return;
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(400).json({ message: 'Invalid credentials' });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user._id, 
          role: user.role, 
          email: user.email,
          schoolId: user.schoolId 
        },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select('-password').populate('schoolId');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
