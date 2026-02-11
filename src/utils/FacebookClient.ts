import axios from 'axios';
import SocialToken from '../models/SocialToken';

class FacebookClient {
    private readonly baseUrl = 'https://graph.facebook.com/v21.0';

    /**
     * Get the stored Facebook token + page ID from DB,
     * falling back to env vars if not yet stored in DB.
     * Auto-exchanges User tokens for Page tokens at runtime.
     */
    private async getCredentials(): Promise<{ accessToken: string; pageId: string }> {
        const tokenDoc = await SocialToken.findOne({ platform: 'facebook' });

        let accessToken = (tokenDoc?.accessToken || process.env.META_ACCESS_TOKEN || '').trim();
        const pageId = (tokenDoc?.pageId || process.env.META_PAGE_ID || '').trim();

        if (!accessToken || !pageId) {
            throw new Error('Facebook credentials missing. Set META_ACCESS_TOKEN and META_PAGE_ID, or store them via the admin setup.');
        }

        // Auto-exchange: check if this is a User token and swap for Page token
        try {
            const accountsResp = await axios.get(`${this.baseUrl}/${pageId}`, {
                params: {
                    fields: 'access_token',
                    access_token: accessToken,
                },
            });

            if (accountsResp.data?.access_token) {
                const pageToken = accountsResp.data.access_token;
                // Only log + save if it's different (i.e., was a user token)
                if (pageToken !== accessToken) {
                    console.log('� Auto-exchanged User Token → Page Access Token');
                    accessToken = pageToken;
                    // Save the Page token to DB so next time it's used directly
                    await SocialToken.findOneAndUpdate(
                        { platform: 'facebook' },
                        { accessToken: pageToken, pageId },
                        { upsert: true }
                    );
                }
            }
        } catch (err: any) {
            console.log('⚠️ Could not auto-exchange for Page Token, using token as-is:', err.response?.data?.error?.message || err.message);
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

        console.log(`📤 Posting to Facebook page ${pageId} (token type will be PAGE after auto-exchange)`);

        try {
            if (imageUrl) {
                // Post with image
                const fullImageUrl = imageUrl.startsWith('http')
                    ? imageUrl
                    : `${process.env.BACKEND_URL || 'http://localhost:5000'}/${imageUrl.replace(/\\/g, '/')}`;

                const response = await axios.post(
                    `${this.baseUrl}/${pageId}/photos`,
                    new URLSearchParams({
                        url: fullImageUrl,
                        message,
                        access_token: accessToken,
                    }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );

                console.log('✅ Facebook photo post published:', response.data.id);
                return response.data.id;
            } else {
                // Text-only post
                const response = await axios.post(
                    `${this.baseUrl}/${pageId}/feed`,
                    new URLSearchParams({
                        message,
                        access_token: accessToken,
                    }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );

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
     * Save credentials with auto User→Page token exchange.
     */
    async saveCredentials(userOrPageToken: string, pageId: string): Promise<void> {
        let pageAccessToken = userOrPageToken.trim();
        const trimmedPageId = pageId.trim();

        // Try to exchange for a proper Page Access Token
        try {
            const pageResp = await axios.get(`${this.baseUrl}/${trimmedPageId}`, {
                params: {
                    fields: 'access_token,name',
                    access_token: pageAccessToken,
                },
            });

            if (pageResp.data?.access_token) {
                pageAccessToken = pageResp.data.access_token;
                console.log(`✅ Got Page Access Token for: ${pageResp.data.name || trimmedPageId}`);
            }
        } catch (err: any) {
            console.log('ℹ️ Could not get Page Token via /{page_id}?fields=access_token, saving as-is:', err.response?.data?.error?.message || err.message);
        }

        await SocialToken.findOneAndUpdate(
            { platform: 'facebook' },
            {
                platform: 'facebook',
                accessToken: pageAccessToken,
                pageId: trimmedPageId,
                tokenExpiresAt: undefined,
            },
            { upsert: true, new: true }
        );
        console.log('✅ Facebook credentials saved to DB');
    }
}

export default new FacebookClient();
