import { Router, Request, Response } from 'express';
import geminiClient from '../utils/geminiClient';
import Submission from '../models/Submission';
import Blog from '../models/Blog';
import SocialPost from '../models/SocialPost';
import SocialToken from '../models/SocialToken';
import School from '../models/School';
import InstagramClient from '../utils/InstagramClient';
import FacebookClient from '../utils/FacebookClient';
import LinkedInClient from '../utils/LinkedInClient';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// @access  Private (Writer, Admin)
router.post(
  '/generate-draft/:submissionId',
  [authMiddleware, roleMiddleware('writer', 'admin', 'marketer', 'school')],
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
        featuredImage: submission.attachments?.[0], // Use the first attachment as featured image
        seoKeywords: aiResponse.seoKeywords,
        readingTime: aiResponse.readingTime,
        category: submission.category,
        tags: aiResponse.seoKeywords,
        status: 'draft_created',
        assignedSchool: submission.schoolId,
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
// @access  Private (Marketer, Admin, Writer, School)
router.post(
  '/generate-social/:blogId',
  [authMiddleware, roleMiddleware('marketer', 'admin', 'writer', 'school')],
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

// @route   POST /api/ai/generate-unified-social/:blogId
// @desc    Generate unified social media post from blog using AI
// @access  Private (Marketer, Admin, Writer, School)
router.post(
  '/generate-unified-social/:blogId',
  [authMiddleware, roleMiddleware('marketer', 'admin', 'writer', 'school')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const blog = await Blog.findById(req.params.blogId);
      if (!blog) {
        res.status(404).json({ message: 'Blog not found' });
        return;
      }

      // Generate unified social post using Gemini AI
      const summary = blog.metaDescription || blog.content.substring(0, 200);
      const aiResponse = await geminiClient.generateUnifiedSocialPost(
        blog.title,
        summary
      );

      res.status(201).json({
        message: 'Unified social post generated successfully',
        socialPost: aiResponse,
      });
    } catch (error: any) {
      console.error('Generate unified social post error:', error);
      res.status(500).json({ message: 'Failed to generate unified social post', error: error.message });
    }
  }
);

// @route   POST /api/ai/post-to-social
// @desc    Save social posts for multiple platforms
// @access  Private (Marketer, Admin, Writer, School)
router.post(
  '/post-to-social',
  [authMiddleware, roleMiddleware('marketer', 'admin', 'writer', 'school')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { blogId, caption, hashtags, platforms } = req.body;

      if (!blogId || !caption || !platforms || !Array.isArray(platforms)) {
        res.status(400).json({ message: 'Missing required fields' });
        return;
      }

      const posts = [];

      for (const platform of platforms) {
        let isPublished = false;
        let publishedId = null;

        if (platform === 'instagram') {
          try {
            // Real Instagram Publishing (using global system accounts)
            const blog = await Blog.findById(blogId);
            const imageUrl = blog?.featuredImage;

            if (imageUrl) {
              const fullImageUrl = imageUrl.startsWith('http')
                ? imageUrl
                : `${process.env.BACKEND_URL || 'http://localhost:5000'}/${imageUrl.replace(/\\/g, '/')}`;

              const creationId = await InstagramClient.createMediaContainer(
                fullImageUrl,
                caption
              );

              publishedId = await InstagramClient.publishMedia(
                creationId
              );
              isPublished = true;
            }
          } catch (error: any) {
            console.error('Central Instagram publish failed:', error.message);
            // Fallback to recording as draft if real post fails
          }
        } else if (platform === 'facebook') {
          try {
            const blog = await Blog.findById(blogId);
            publishedId = await FacebookClient.postToPageFeed(
              caption,
              blog?.featuredImage
            );
            isPublished = true;
          } catch (error: any) {
            console.error('Facebook publish failed:', error.message);
          }
        } else if (platform === 'linkedin') {
          try {
            const blog = await Blog.findById(blogId);
            publishedId = await LinkedInClient.createPost(
              caption,
              blog?.featuredImage
            );
            isPublished = true;
          } catch (error: any) {
            console.error('LinkedIn publish failed:', error.message);
          }
        } else if (platform === 'twitter') {
          // Twitter/X - still simulated
          isPublished = true;
        }

        const socialPost = new SocialPost({
          blogId,
          platform,
          caption,
          hashtags,
          isPublished: isPublished,
          publishedId: publishedId,
          createdBy: req.user!.id,
        });
        await socialPost.save();
        posts.push(socialPost);
      }

      res.status(201).json({
        message: 'Social posts recorded successfully',
        posts,
      });
    } catch (error: any) {
      console.error('Post to social error:', error);
      res.status(500).json({ message: 'Failed to record social posts', error: error.message });
    }
  }
);

// ============================================================
// LinkedIn OAuth Setup Routes (one-time setup)
// ============================================================

// @route   GET /api/ai/linkedin/auth
// @desc    Redirect to LinkedIn OAuth authorization page
// @access  Public (opens in popup - LinkedIn login itself is the security gate)
router.get(
  '/linkedin/auth',
  (req: Request, res: Response): void => {
    try {
      const authUrl = LinkedInClient.getAuthUrl();
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   GET /api/ai/linkedin/callback
// @desc    Handle LinkedIn OAuth callback, exchange code for tokens
// @access  Public (callback URL)
router.get(
  '/linkedin/callback',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, error } = req.query;

      if (error) {
        res.status(400).json({ message: `LinkedIn OAuth error: ${error}` });
        return;
      }

      if (!code || typeof code !== 'string') {
        res.status(400).json({ message: 'Missing authorization code' });
        return;
      }

      await LinkedInClient.exchangeCodeForTokens(code);

      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #111; color: #fff;">
            <div style="text-align: center;">
              <h1>✅ LinkedIn Connected!</h1>
              <p>Tokens have been saved. You can close this window.</p>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('LinkedIn callback error:', error);
      res.status(500).json({ message: 'LinkedIn OAuth callback failed', error: error.message });
    }
  }
);

// ============================================================
// Social Accounts Management (for Settings UI)
// ============================================================

// @route   GET /api/ai/social-accounts/status
// @desc    Get connection status for all social platforms
// @access  Private (Admin only)
router.get(
  '/social-accounts/status',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const fbToken = await SocialToken.findOne({ platform: 'facebook' });
      const liToken = await SocialToken.findOne({ platform: 'linkedin' });

      // Check Facebook: either DB token or env vars
      const fbConnected = !!(fbToken?.accessToken || process.env.META_ACCESS_TOKEN);
      const fbPageId = fbToken?.pageId || process.env.META_PAGE_ID || null;

      // Check LinkedIn: must have DB token
      const liConnected = !!(liToken?.accessToken && liToken?.personUrn);
      const liExpiresAt = liToken?.tokenExpiresAt || null;

      // Instagram: uses same Meta token
      const igConnected = !!(process.env.META_ACCESS_TOKEN && process.env.META_INSTAGRAM_ACCOUNT_ID);

      res.json({
        facebook: {
          connected: fbConnected,
          pageId: fbPageId,
          source: fbToken ? 'database' : (process.env.META_ACCESS_TOKEN ? 'env' : 'none'),
        },
        linkedin: {
          connected: liConnected,
          personUrn: liToken?.personUrn || null,
          expiresAt: liExpiresAt,
          hasRefreshToken: !!liToken?.refreshToken,
        },
        instagram: {
          connected: igConnected,
          accountId: process.env.META_INSTAGRAM_ACCOUNT_ID || null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get social account status', error: error.message });
    }
  }
);

// @route   POST /api/ai/social-accounts/facebook
// @desc    Save Facebook Page credentials
// @access  Private (Admin only)
router.post(
  '/social-accounts/facebook',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { accessToken, pageId } = req.body;

      if (!accessToken || !pageId) {
        res.status(400).json({ message: 'Access token and page ID are required' });
        return;
      }

      await FacebookClient.saveCredentials(accessToken, pageId);
      res.json({ message: 'Facebook credentials saved successfully' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to save Facebook credentials', error: error.message });
    }
  }
);

// @route   DELETE /api/ai/social-accounts/:platform
// @desc    Disconnect a social platform
// @access  Private (Admin only)
router.delete(
  '/social-accounts/:platform',
  [authMiddleware, roleMiddleware('admin')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { platform } = req.params;

      if (!['facebook', 'linkedin'].includes(platform)) {
        res.status(400).json({ message: 'Invalid platform' });
        return;
      }

      await SocialToken.deleteOne({ platform });
      res.json({ message: `${platform} account disconnected` });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to disconnect account', error: error.message });
    }
  }
);

export default router;
