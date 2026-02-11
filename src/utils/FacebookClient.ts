import axios from 'axios';
import SocialToken from '../models/SocialToken';

class FacebookClient {
    private readonly baseUrl = 'https://graph.facebook.com/v21.0';

    /**
     * Get the stored Facebook token + page ID from DB,
     * falling back to env vars if not yet stored in DB.
     */
    private async getCredentials(): Promise<{ accessToken: string; pageId: string }> {
        const tokenDoc = await SocialToken.findOne({ platform: 'facebook' });

        const accessToken = (tokenDoc?.accessToken || process.env.META_ACCESS_TOKEN || '').trim();
        const pageId = (tokenDoc?.pageId || process.env.META_PAGE_ID || '').trim();

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

        // Debug: check token type before posting
        try {
            const debugResp = await axios.get(`${this.baseUrl}/debug_token`, {
                params: {
                    input_token: accessToken,
                    access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
                },
            });
            const tokenInfo = debugResp.data?.data;
            console.log('🔍 Token Debug Info:', JSON.stringify({
                type: tokenInfo?.type,
                app_id: tokenInfo?.app_id,
                is_valid: tokenInfo?.is_valid,
                scopes: tokenInfo?.scopes,
                granular_scopes: tokenInfo?.granular_scopes,
                expires_at: tokenInfo?.expires_at,
            }, null, 2));
        } catch (debugErr: any) {
            console.log('⚠️ Could not debug token:', debugErr.message);
        }

        try {
            if (imageUrl) {
                // Post with image — send as form data in body
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
                // Text-only post — send as form data in body
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
     * Save credentials — accepts a User Token and auto-exchanges it for a Page Token.
     * If a Page Access Token is passed directly, it's saved as-is.
     */
    async saveCredentials(userOrPageToken: string, pageId: string): Promise<void> {
        let pageAccessToken = userOrPageToken;

        try {
            // Try to get the proper Page Access Token from /me/accounts
            const accountsResponse = await axios.get(`${this.baseUrl}/me/accounts`, {
                params: {
                    access_token: userOrPageToken,
                    fields: 'id,name,access_token',
                },
            });

            const pages = accountsResponse.data?.data || [];
            const matchingPage = pages.find((p: any) => p.id === pageId);

            if (matchingPage?.access_token) {
                pageAccessToken = matchingPage.access_token;
                console.log(`✅ Exchanged User Token for Page Access Token (page: ${matchingPage.name})`);
            } else {
                console.log('ℹ️ No page match in /me/accounts — using token as-is (may already be a Page Token)');
            }
        } catch (err: any) {
            console.log('ℹ️ Could not exchange for Page Token, saving as-is:', err.message);
        }

        await SocialToken.findOneAndUpdate(
            { platform: 'facebook' },
            {
                platform: 'facebook',
                accessToken: pageAccessToken,
                pageId,
                tokenExpiresAt: undefined,
            },
            { upsert: true, new: true }
        );
        console.log('✅ Facebook credentials saved to DB');
    }
}

export default new FacebookClient();
