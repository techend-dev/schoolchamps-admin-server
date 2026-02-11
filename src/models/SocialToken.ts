import mongoose, { Schema, Document } from 'mongoose';

export interface ISocialToken extends Document {
    platform: 'facebook' | 'linkedin';
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    pageId?: string;        // Facebook Page ID
    personUrn?: string;     // LinkedIn person URN (urn:li:person:xxx)
    orgUrn?: string;        // LinkedIn organization URN (optional)
    metadata?: Record<string, any>;
    updatedAt: Date;
    createdAt: Date;
}

const SocialTokenSchema: Schema = new Schema(
    {
        platform: {
            type: String,
            enum: ['facebook', 'linkedin'],
            required: true,
            unique: true,
        },
        accessToken: {
            type: String,
            required: true,
        },
        refreshToken: {
            type: String,
        },
        tokenExpiresAt: {
            type: Date,
        },
        pageId: {
            type: String,
        },
        personUrn: {
            type: String,
        },
        orgUrn: {
            type: String,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<ISocialToken>('SocialToken', SocialTokenSchema);
