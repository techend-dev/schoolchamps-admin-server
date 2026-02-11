import axios from 'axios';
import SocialToken from '../models/SocialToken';

class LinkedInClient {
    private readonly apiUrl = 'https://api.linkedin.com';
    private readonly oauthUrl = 'https://www.linkedin.com/oauth/v2';
    private readonly clientId = process.env.LINKEDIN_CLIENT_ID;
    private readonly clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    private readonly redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    /**
     * Get stored LinkedIn credentials from DB.
     */
    private async getCredentials(): Promise<{ accessToken: string; personUrn: string; orgUrn?: string }> {
        const tokenDoc = await SocialToken.findOne({ platform: 'linkedin' });

        if (!tokenDoc?.accessToken || !tokenDoc?.personUrn) {
            throw new Error('LinkedIn credentials not configured. Complete the OAuth setup first via /api/ai/linkedin/auth');
        }

        return {
            accessToken: tokenDoc.accessToken,
            personUrn: tokenDoc.personUrn,
            orgUrn: tokenDoc.orgUrn,
        };
    }

    /**
     * Generate the OAuth authorization URL for initial setup.
     * Includes organization scopes for page management.
     */
    getAuthUrl(): string {
        if (!this.clientId || !this.redirectUri) {
            throw new Error('LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI must be set in .env');
        }

        // Updated scopes to include organization posting
        const scopes = 'openid profile w_member_social w_organization_social rw_organization_admin';
        return `${this.oauthUrl}/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    }

    /**
     * Exchange authorization code for access + refresh tokens.
     */
    async exchangeCodeForTokens(code: string): Promise<void> {
        try {
            const response = await axios.post(`${this.oauthUrl}/accessToken`, null, {
                params: {
                    grant_type: 'authorization_code',
                    code,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    redirect_uri: this.redirectUri,
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const { access_token, refresh_token, expires_in } = response.data;

            // Fetch the user's person URN
            const profileResponse = await axios.get(`${this.apiUrl}/v2/userinfo`, {
                headers: { Authorization: `Bearer ${access_token}` },
            });

            const personUrn = `urn:li:person:${profileResponse.data.sub}`;

            await SocialToken.findOneAndUpdate(
                { platform: 'linkedin' },
                {
                    platform: 'linkedin',
                    accessToken: access_token,
                    refreshToken: refresh_token || undefined,
                    tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
                    personUrn,
                },
                { upsert: true, new: true }
            );

            console.log('✅ LinkedIn OAuth tokens saved. Person URN:', personUrn);
        } catch (error: any) {
            console.error('❌ LinkedIn token exchange failed:', error.response?.data || error.message);
            throw new Error(`LinkedIn OAuth failed: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Fetch organizations where the authenticated user is an administrator.
     */
    async getManagedOrganizations(): Promise<any[]> {
        const { accessToken } = await this.getCredentials();

        try {
            // Step 1: Get organizational access control elements
            const response = await axios.get(`${this.apiUrl}/rest/organizationalEntityAcls?q=roleAssignee`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'LinkedIn-Version': '202401',
                    'X-Restli-Protocol-Version': '2.0.0',
                },
            });

            const organizations = response.data.elements || [];
            const orgList = [];

            for (const org of organizations) {
                const orgUrn = org.organizationalTarget;

                try {
                    // Step 2: Fetch organization details (name/logo)
                    const detailResponse = await axios.get(`${this.apiUrl}/rest/organizations/${orgUrn.split(':').pop()}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'LinkedIn-Version': '202401',
                            'X-Restli-Protocol-Version': '2.0.0',
                        },
                    });

                    orgList.push({
                        urn: orgUrn,
                        name: detailResponse.data.localizedName || detailResponse.data.vanityName,
                        vanityName: detailResponse.data.vanityName,
                    });
                } catch (e: any) {
                    console.warn(`Could not fetch details for org ${orgUrn}:`, e.message);
                    orgList.push({ urn: orgUrn, name: 'Unknown Organization' });
                }
            }

            return orgList;
        } catch (error: any) {
            console.error('❌ Failed to fetch LinkedIn organizations:', error.response?.data || error.message);
            throw new Error(`Failed to fetch LinkedIn organizations: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Refresh the access token using the stored refresh token.
     */
    async refreshAccessToken(): Promise<boolean> {
        try {
            const tokenDoc = await SocialToken.findOne({ platform: 'linkedin' });

            if (!tokenDoc?.refreshToken) {
                console.warn('⚠️ No LinkedIn refresh token available. Re-authorization needed.');
                return false;
            }

            const response = await axios.post(`${this.oauthUrl}/accessToken`, null, {
                params: {
                    grant_type: 'refresh_token',
                    refresh_token: tokenDoc.refreshToken,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const { access_token, refresh_token, expires_in } = response.data;

            tokenDoc.accessToken = access_token;
            if (refresh_token) tokenDoc.refreshToken = refresh_token;
            tokenDoc.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
            await tokenDoc.save();

            console.log('✅ LinkedIn access token refreshed. Expires at:', tokenDoc.tokenExpiresAt);
            return true;
        } catch (error: any) {
            console.error('❌ LinkedIn token refresh failed:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Register an image upload with LinkedIn and upload the image.
     */
    private async uploadImage(imageUrl: string, accessToken: string, ownerUrn: string): Promise<string> {
        const initResponse = await axios.post(
            `${this.apiUrl}/rest/images?action=initializeUpload`,
            {
                initializeUploadRequest: {
                    owner: ownerUrn,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'LinkedIn-Version': '202401',
                    'X-Restli-Protocol-Version': '2.0.0',
                },
            }
        );

        const uploadUrl = initResponse.data.value.uploadUrl;
        const imageUrn = initResponse.data.value.image;

        const fullImageUrl = imageUrl.startsWith('http')
            ? imageUrl
            : `${process.env.BACKEND_URL || 'http://localhost:5000'}/${imageUrl.replace(/\\/g, '/')}`;

        const imageResponse = await axios.get(fullImageUrl, { responseType: 'arraybuffer' });

        await axios.put(uploadUrl, imageResponse.data, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
            },
        });

        return imageUrn;
    }

    /**
     * Create a post on LinkedIn with optional image.
     * Posts to organization if orgUrn is available, otherwise falls back to personUrn.
     */
    async createPost(text: string, imageUrl?: string): Promise<string> {
        const { accessToken, personUrn, orgUrn } = await this.getCredentials();
        const targetAuthor = orgUrn || personUrn;

        try {
            const postBody: any = {
                author: targetAuthor,
                commentary: text,
                visibility: 'PUBLIC',
                distribution: {
                    feedDistribution: 'MAIN_FEED',
                    targetEntities: [],
                    thirdPartyDistributionChannels: [],
                },
                lifecycleState: 'PUBLISHED',
            };

            if (imageUrl) {
                const imageUrn = await this.uploadImage(imageUrl, accessToken, targetAuthor);
                postBody.content = {
                    media: {
                        title: 'Post Image',
                        id: imageUrn,
                    },
                };
            }

            const response = await axios.post(`${this.apiUrl}/rest/posts`, postBody, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'LinkedIn-Version': '202401',
                    'X-Restli-Protocol-Version': '2.0.0',
                },
            });

            const postUrn = response.headers['x-restli-id'] || response.data?.id || 'posted';
            console.log(`✅ LinkedIn post published to ${orgUrn ? 'Organization' : 'Profile'}:`, postUrn);
            return postUrn;
        } catch (error: any) {
            console.error('❌ LinkedIn post failed:', error.response?.data || error.message);
            throw new Error(`LinkedIn publish failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Check if the current token is still valid.
     */
    async validateToken(): Promise<boolean> {
        try {
            const { accessToken } = await this.getCredentials();
            const response = await axios.get(`${this.apiUrl}/v2/userinfo`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            return !!response.data.sub;
        } catch {
            return false;
        }
    }
}

export default new LinkedInClient();
