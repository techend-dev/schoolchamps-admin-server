import axios from 'axios';

class InstagramClient {
    private readonly baseUrl = 'https://graph.facebook.com/v18.0';
    private readonly appId = process.env.META_APP_ID;
    private readonly appSecret = process.env.META_APP_SECRET;
    private readonly globalAccessToken = process.env.META_ACCESS_TOKEN;
    private readonly globalInstagramAccountId = process.env.META_INSTAGRAM_ACCOUNT_ID;

    /**
     * Step 1: Create a media container
     */
    async createMediaContainer(imageUrl: string, caption: string, instagramAccountId?: string, accessToken?: string) {
        try {
            const targetAccountId = instagramAccountId || this.globalInstagramAccountId;
            const targetToken = accessToken || this.globalAccessToken;

            if (!targetAccountId || !targetToken) {
                throw new Error('Instagram credentials missing (Account ID or Access Token)');
            }

            const response = await axios.post(`${this.baseUrl}/${targetAccountId}/media`, null, {
                params: {
                    image_url: imageUrl,
                    caption: caption,
                    access_token: targetToken,
                },
            });
            return response.data.id; // creation_id
        } catch (error: any) {
            console.error('Error creating media container:', error.response?.data || error.message);
            throw new Error(`Instagram Media Container failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Step 2: Publish the media container
     */
    async publishMedia(creationId: string, instagramAccountId?: string, accessToken?: string) {
        try {
            const targetAccountId = instagramAccountId || this.globalInstagramAccountId;
            const targetToken = accessToken || this.globalAccessToken;

            if (!targetAccountId || !targetToken) {
                throw new Error('Instagram credentials missing (Account ID or Access Token)');
            }

            const response = await axios.post(`${this.baseUrl}/${targetAccountId}/media_publish`, null, {
                params: {
                    creation_id: creationId,
                    access_token: targetToken,
                },
            });
            return response.data.id; // post_id
        } catch (error: any) {
            console.error('Error publishing media:', error.response?.data || error.message);
            throw new Error(`Instagram Publish failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * DEPRECATED: Per-school OAuth flow methods
     * Kept for internal use if we ever need to refresh the global token manually
     */
    async getLongLivedToken(shortLivedToken: string) {
        try {
            const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: this.appId,
                    client_secret: this.appSecret,
                    fb_exchange_token: shortLivedToken,
                },
            });
            return response.data.access_token;
        } catch (error: any) {
            console.error('Error getting long-lived token:', error.response?.data || error.message);
            throw new Error('Failed to obtain long-lived token');
        }
    }

    async getInstagramAccounts(accessToken: string) {
        try {
            const pagesResponse = await axios.get(`${this.baseUrl}/me/accounts`, {
                params: { access_token: accessToken },
            });

            const pages = pagesResponse.data.data;
            if (!pages || pages.length === 0) return [];

            const igAccounts = [];
            for (const page of pages) {
                const pageResponse = await axios.get(`${this.baseUrl}/${page.id}`, {
                    params: {
                        fields: 'instagram_business_account',
                        access_token: accessToken,
                    },
                });

                if (pageResponse.data.instagram_business_account) {
                    igAccounts.push({
                        pageId: page.id,
                        pageName: page.name,
                        instagramAccountId: pageResponse.data.instagram_business_account.id,
                    });
                }
            }
            return igAccounts;
        } catch (error: any) {
            console.error('Error fetching Instagram accounts:', error.response?.data || error.message);
            throw new Error('Failed to fetch linked Instagram accounts');
        }
    }
}

export default new InstagramClient();
