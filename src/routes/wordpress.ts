import { Router, Response } from 'express';
import Blog from '../models/Blog';
import Submission from '../models/Submission';
import Transaction from '../models/Transaction';
import wordpressClient from '../utils/wordpressClient';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { upload } from '../utils/multerConfig';
import fs from 'fs';

const router = Router();

// @route   POST /api/wordpress/publish/:id
// @desc    Publish blog to WordPress
// @access  Private (School, Admin, Writer)
router.post(
  '/publish/:id',
  [authMiddleware, roleMiddleware('school', 'admin', 'writer')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const blog = await Blog.findById(req.params.id);

      if (!blog) {
        res.status(404).json({ message: 'Blog not found' });
        return;
      }

      // Ensure blog is assigned to a school
      if (!blog.assignedSchool) {
        res.status(400).json({ message: 'Blog must be assigned to a school before publishing' });
        return;
      }

      // Verify school ownership or admin/writer permission
      if (req.user?.role === 'school' && blog.assignedSchool.toString() !== req.user?.schoolId) {
        res.status(403).json({ message: 'Not authorized to publish this blog' });
        return;
      }

      // Credit System: Each post costs 99 coins.
      const School = require('../models/School').default; // Use require if import is not available at top
      const school = await School.findById(blog.assignedSchool);

      if (!school) {
        res.status(404).json({ message: 'Assigned school not found' });
        return;
      }

      if (school.coins < 99 && req.user?.role !== 'admin') {
        res.status(403).json({
          message: 'Insufficient coins. Each post requires 99 coins.',
          availableCoins: school.coins
        });
        return;
      }

      // Deduct 99 coins and earn 50 coins (net -49)
      if (req.user?.role !== 'admin') {
        const coinsBefore = school.coins;
        school.coins = coinsBefore - 99 + 50;
        await school.save();

        // Log Debit Transaction
        await Transaction.create({
          schoolId: school._id,
          type: 'debit',
          coins: 99,
          coinsBefore: coinsBefore,
          coinsAfter: coinsBefore - 99,
          referenceId: blog._id,
          description: `Post publishing cost: ${blog.title}`,
        });

        // Log Reward Transaction
        await Transaction.create({
          schoolId: school._id,
          type: 'reward',
          coins: 50,
          coinsBefore: coinsBefore - 99,
          coinsAfter: school.coins,
          referenceId: blog._id,
          description: `Reward for publishing: ${blog.title}`,
        });
      }

      let featuredMediaId: number | undefined;

      // Upload featured image if exists
      if (blog.featuredImage) {
        try {
          const isRemote = blog.featuredImage.startsWith('http');
          if (isRemote || fs.existsSync(blog.featuredImage)) {
            const mediaResponse = await wordpressClient.uploadMedia({
              path: blog.featuredImage,
              originalname: blog.featuredImage.split('/').pop()?.split('?')[0] || 'image.jpg',
              mimetype: 'image/jpeg',
            } as Express.Multer.File);
            featuredMediaId = mediaResponse.id;
          }
        } catch (uploadError: any) {
          console.error('Image upload error:', uploadError);
          // Continue without featured image if upload fails
        }
      }

      // Create tags
      const tagIds: number[] = [];
      if (blog.tags && blog.tags.length > 0) {
        try {
          const existingTags = await wordpressClient.getTags();
          for (const tagName of blog.tags) {
            const existingTag = existingTags.find(
              (t: any) => t.name.toLowerCase() === tagName.toLowerCase()
            );
            if (existingTag) {
              tagIds.push(existingTag.id);
            } else {
              const newTag = await wordpressClient.createTag(tagName);
              tagIds.push(newTag.id);
            }
          }
        } catch (tagError: any) {
          console.error('Tag creation error:', tagError);
        }
      }

      // Publish to WordPress
      const wpPost = await wordpressClient.createPost({
        title: blog.title,
        slug: blog.slug,
        content: blog.content,
        excerpt: blog.metaDescription,
        status: 'publish',
        featured_media: featuredMediaId,
        meta: {
          _yoast_wpseo_title: blog.metaTitle,
          _yoast_wpseo_metadesc: blog.metaDescription,
        },
        tags: tagIds,
      });

      // Update blog with WordPress info
      blog.wordpressPostId = wpPost.id;
      blog.wordpressUrl = wpPost.link;
      blog.status = 'published_wp';
      blog.publishedAt = new Date();
      await blog.save();

      // Update submission status
      await Submission.findByIdAndUpdate(blog.submissionId, {
        status: 'published_wp',
      });

      res.json({
        message: 'Blog published to WordPress successfully',
        blog,
        wordpressUrl: wpPost.link,
      });
    } catch (error: any) {
      console.error('Publish to WordPress error:', error);
      res.status(500).json({ message: 'Failed to publish to WordPress', error: error.message });
    }
  }
);

// @route   POST /api/wordpress/upload-media
// @desc    Upload media to WordPress
// @access  Private
router.post(
  '/upload-media',
  authMiddleware,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
      }

      const mediaResponse = await wordpressClient.uploadMedia(req.file);

      // Delete local file after upload if it exists
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.json({
        message: 'Media uploaded successfully',
        media: {
          id: mediaResponse.id,
          url: mediaResponse.source_url,
          title: mediaResponse.title.rendered,
        },
      });
    } catch (error: any) {
      console.error('Upload media error:', error);
      res.status(500).json({ message: 'Failed to upload media', error: error.message });
    }
  }
);

// @route   GET /api/wordpress/posts/:id
// @desc    Get WordPress post by ID
// @access  Private
router.get(
  '/posts/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const wpPost = await wordpressClient.getPost(parseInt(req.params.id));

      res.json({ post: wpPost });
    } catch (error: any) {
      console.error('Get WordPress post error:', error);
      res.status(500).json({ message: 'Failed to get WordPress post', error: error.message });
    }
  }
);

// @route   GET /api/wordpress/posts
// @desc    Get all WordPress posts
// @access  Private
router.get(
  '/posts',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const wpPosts = await wordpressClient.getPosts();

      res.json({ posts: wpPosts });
    } catch (error: any) {
      console.error('Get WordPress posts error:', error);
      res.status(500).json({ message: 'Failed to get WordPress posts', error: error.message });
    }
  }
);

export default router;
