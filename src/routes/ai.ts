import { Router, Response } from 'express';
import geminiClient from '../utils/geminiClient';
import Submission from '../models/Submission';
import Blog from '../models/Blog';
import SocialPost from '../models/SocialPost';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// @route   POST /api/ai/generate-draft/:submissionId
// @desc    Generate blog draft from submission using AI
// @access  Private (Writer, Admin)
router.post(
  '/generate-draft/:submissionId',
  [authMiddleware, roleMiddleware('writer', 'admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const submission = await Submission.findById(req.params.submissionId);

      if (!submission) {
        res.status(404).json({ message: 'Submission not found' });
        return;
      }

      // Generate draft using Gemini AI
      const aiResponse = await geminiClient.generateBlogDraft(
        submission.title,
        submission.description,
        submission.category
      );

      // Create blog document
      const blog = new Blog({
        submissionId: submission._id,
        title: aiResponse.title,
        content: aiResponse.content,
        slug: aiResponse.slug,
        metaTitle: aiResponse.metaTitle,
        metaDescription: aiResponse.metaDescription,
        seoKeywords: aiResponse.seoKeywords,
        readingTime: aiResponse.readingTime,
        category: submission.category,
        tags: aiResponse.seoKeywords,
        status: 'draft_created',
        createdBy: req.user!.id,
      });

      await blog.save();

      // Update submission status
      submission.status = 'draft_created';
      await submission.save();

      res.status(201).json({
        message: 'Draft generated successfully',
        blog,
      });
    } catch (error: any) {
      console.error('Generate draft error:', error);
      res.status(500).json({ message: 'Failed to generate draft', error: error.message });
    }
  }
);

// @route   POST /api/ai/generate-social/:blogId
// @desc    Generate social media post from blog using AI
// @access  Private (Marketer, Admin)
router.post(
  '/generate-social/:blogId',
  [authMiddleware, roleMiddleware('marketer', 'admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { platform } = req.body;

      if (!['instagram', 'linkedin', 'twitter', 'facebook'].includes(platform)) {
        res.status(400).json({ message: 'Invalid platform' });
        return;
      }

      const blog = await Blog.findById(req.params.blogId);
      if (!blog) {
        res.status(404).json({ message: 'Blog not found' });
        return;
      }

      // Generate social post using Gemini AI
      const summary = blog.metaDescription || blog.content.substring(0, 200);
      const aiResponse = await geminiClient.generateSocialPost(
        blog.title,
        summary,
        platform as 'instagram' | 'linkedin' | 'twitter' | 'facebook'
      );

      // Create social post document
      const socialPost = new SocialPost({
        blogId: blog._id,
        platform,
        caption: aiResponse.caption,
        hashtags: aiResponse.hashtags,
        createdBy: req.user!.id,
      });

      await socialPost.save();

      res.status(201).json({
        message: 'Social post generated successfully',
        socialPost,
      });
    } catch (error: any) {
      console.error('Generate social post error:', error);
      res.status(500).json({ message: 'Failed to generate social post', error: error.message });
    }
  }
);

// @route   POST /api/ai/improve-content
// @desc    Improve content using AI
// @access  Private
router.post(
  '/improve-content',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { content, instruction } = req.body;

      if (!content || !instruction) {
        res.status(400).json({ message: 'Content and instruction are required' });
        return;
      }

      const improvedContent = await geminiClient.improveContent(content, instruction);

      res.json({
        message: 'Content improved successfully',
        improvedContent,
      });
    } catch (error: any) {
      console.error('Improve content error:', error);
      res.status(500).json({ message: 'Failed to improve content', error: error.message });
    }
  }
);

export default router;
