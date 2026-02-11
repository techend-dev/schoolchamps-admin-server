import axios from 'axios';
import SocialToken from '../models/SocialToken';

class FacebookClient {
    private readonly baseUrl = 'https://graph.facebook.com/v18.0';

    /**
     * Get the stored Facebook token + page ID from DB,
     * falling back to env vars if not yet stored in DB.
     */
    private async getCredentials(): Promise<{ accessToken: string; pageId: string }> {
        const tokenDoc = await SocialToken.findOne({ platform: 'facebook' });

        const accessToken = tokenDoc?.accessToken || process.env.META_ACCESS_TOKEN;
        const pageId = tokenDoc?.pageId || process.env.META_PAGE_ID;

        if (!accessToken || !pageId) {
            throw new Error('Facebook credentials missing. Set META_ACCESS_TOKEN and META_PAGE_ID, or store them via the admin setup.');
        }

        return { accessToken, pageId };
    }

    /**
     * Post a photo with caption to a Facebook Page.
     * Uses /{page_id}/photos with a publicly accessible image URL.
     * Returns the post ID.
     */
    async postToPageFeed(message: string, imageUrl?: string): Promise<string> {
        const { accessToken, pageId } = await this.getCredentials();

        try {
            if (imageUrl) {
                // Post with image
                const fullImageUrl = imageUrl.startsWith('http')
                    ? imageUrl
                    : `${process.env.BACKEND_URL || 'http://localhost:5000'}/${imageUrl.replace(/\\/g, '/')}`;

                const response = await axios.post(`${this.baseUrl}/${pageId}/photos`, null, {
                    params: {
                        url: fullImageUrl,
                        message,
                        access_token: accessToken,
                    },
                });

                console.log('✅ Facebook photo post published:', response.data.id);
                return response.data.id;
            } else {
                // Text-only post
                const response = await axios.post(`${this.baseUrl}/${pageId}/feed`, null, {
                    params: {
                        message,
                        access_token: accessToken,
                    },
                });

                console.log('✅ Facebook text post published:', response.data.id);
                return response.data.id;
            }
        } catch (error: any) {
            console.error('❌ Facebook post failed:', error.response?.data || error.message);
            throw new Error(`Facebook publish failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Validate that the stored/env token is still valid.
     * Returns true if token works, false otherwise.
     */
    async validateToken(): Promise<boolean> {
        try {
            const { accessToken } = await this.getCredentials();
            const response = await axios.get(`${this.baseUrl}/me`, {
                params: { access_token: accessToken },
            });
            return !!response.data.id;
        } catch {
            return false;
        }
    }

    /**
     * Store or update Facebook credentials in DB.
     */
    async saveCredentials(accessToken: string, pageId: string): Promise<void> {
        await SocialToken.findOneAndUpdate(
            { platform: 'facebook' },
            {
                platform: 'facebook',
                accessToken,
                pageId,
                // Facebook long-lived page tokens don't expire
                tokenExpiresAt: undefined,
            },
            { upsert: true, new: true }
        );
        console.log('✅ Facebook credentials saved to DB');
    }
}

export default new FacebookClient();
