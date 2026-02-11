import * as cron from 'node-cron';
import LinkedInClient from './LinkedInClient';
import FacebookClient from './FacebookClient';
import SocialToken from '../models/SocialToken';

/**
 * Token Refresh Service
 * Runs daily at 3:00 AM to:
 * - Refresh LinkedIn access tokens approaching expiry (within 7 days)
 * - Validate Facebook page tokens are still active
 */
class TokenRefreshService {
    private job: cron.ScheduledTask | null = null;

    /**
     * Start the daily cron job.
     */
    start() {
        // Run every day at 3:00 AM
        this.job = cron.schedule('0 3 * * *', async () => {
            console.log('🔄 [TokenRefresh] Running daily token health check...');
            await this.refreshAll();
        });

        console.log('✅ [TokenRefresh] Cron job scheduled: daily at 3:00 AM');
    }

    /**
     * Stop the cron job.
     */
    stop() {
        if (this.job) {
            this.job.stop();
            console.log('⏹️ [TokenRefresh] Cron job stopped.');
        }
    }

    /**
     * Run all refresh/validation checks.
     * Can be called manually for testing.
     */
    async refreshAll() {
        await this.checkLinkedIn();
        await this.checkFacebook();
    }

    /**
     * Check and refresh LinkedIn token if expiring within 7 days.
     */
    private async checkLinkedIn() {
        try {
            const tokenDoc = await SocialToken.findOne({ platform: 'linkedin' });

            if (!tokenDoc) {
                console.log('ℹ️ [TokenRefresh] No LinkedIn token stored — skipping.');
                return;
            }

            if (!tokenDoc.tokenExpiresAt) {
                console.log('⚠️ [TokenRefresh] LinkedIn token has no expiry date — validating...');
                const isValid = await LinkedInClient.validateToken();
                console.log(`   LinkedIn token valid: ${isValid}`);
                return;
            }

            const daysUntilExpiry = Math.floor(
                (tokenDoc.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );

            console.log(`ℹ️ [TokenRefresh] LinkedIn token expires in ${daysUntilExpiry} days.`);

            if (daysUntilExpiry <= 7) {
                console.log('🔄 [TokenRefresh] LinkedIn token expiring soon — refreshing...');
                const success = await LinkedInClient.refreshAccessToken();
                if (success) {
                    console.log('✅ [TokenRefresh] LinkedIn token refreshed successfully.');
                } else {
                    console.error('❌ [TokenRefresh] LinkedIn token refresh FAILED. Manual re-auth may be needed.');
                }
            } else {
                console.log('✅ [TokenRefresh] LinkedIn token is healthy.');
            }
        } catch (error: any) {
            console.error('❌ [TokenRefresh] LinkedIn check error:', error.message);
        }
    }

    /**
     * Validate Facebook token is still active.
     * Facebook long-lived page tokens don't expire by time,
     * but can be invalidated by password changes or permission revocations.
     */
    private async checkFacebook() {
        try {
            const tokenDoc = await SocialToken.findOne({ platform: 'facebook' });

            if (!tokenDoc && !process.env.META_ACCESS_TOKEN) {
                console.log('ℹ️ [TokenRefresh] No Facebook token stored or in env — skipping.');
                return;
            }

            const isValid = await FacebookClient.validateToken();
            if (isValid) {
                console.log('✅ [TokenRefresh] Facebook token is valid.');
            } else {
                console.error('❌ [TokenRefresh] Facebook token is INVALID! Please re-generate via Meta Graph Explorer.');
            }
        } catch (error: any) {
            console.error('❌ [TokenRefresh] Facebook check error:', error.message);
        }
    }
}

export default new TokenRefreshService();
