import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
    schoolId: mongoose.Types.ObjectId;
    type: 'purchase' | 'debit' | 'reward';
    coins: number;
    amount?: number; // Real money amount in currency (e.g., 99 for purchase)
    coinsBefore: number;
    coinsAfter: number;
    referenceId?: string; // Razorpay payment ID or Blog ID
    description?: string;
    createdAt: Date;
}

const TransactionSchema: Schema = new Schema(
    {
        schoolId: {
            type: Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
        type: {
            type: String,
            enum: ['purchase', 'debit', 'reward'],
            required: true,
        },
        coins: {
            type: Number,
            required: true,
        },
        amount: {
            type: Number,
        },
        coinsBefore: {
            type: Number,
            required: true,
        },
        coinsAfter: {
            type: Number,
            required: true,
        },
        referenceId: {
            type: String,
        },
        description: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
