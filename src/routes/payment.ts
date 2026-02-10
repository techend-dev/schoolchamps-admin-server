import { Router, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import School from '../models/School';
import Transaction from '../models/Transaction';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Initialize Razorpay
// Note: In production, these should be handled securely.
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

/**
 * @route   POST /api/payment/create-order
 * @desc    Create a Razorpay order for purchasing credits
 * @access  Private (School Admin)
 */
router.post(
    '/create-order',
    authMiddleware,
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'school' || !req.user?.schoolId) {
                res.status(403).json({ message: 'Only schools can purchase credits' });
                return;
            }

            // Amount calculation:
            // Base: ₹99
            // Platform Fee (2%): ₹1.98
            // GST on Fee (18% of 1.98): ₹0.3564 -> ₹0.36
            // Total convenience fee: ₹1.98 + ₹0.36 = ₹2.34
            // Total Amount: ₹99 + ₹2.34 = ₹101.34
            // Rounded as requested: ₹101.35
            // Razorpay expects amount in paise (101.35 * 100 = 10135)
            const amount = 10135;
            const options = {
                amount,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`,
            };

            const order = await razorpay.orders.create(options);
            res.json({ order });
        } catch (error: any) {
            console.error('Create order error:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }
);

/**
 * @route   POST /api/payment/verify
 * @desc    Verify Razorpay payment signature and add credits
 * @access  Private (School Admin)
 */
router.post(
    '/verify',
    authMiddleware,
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'school' || !req.user?.schoolId) {
                res.status(403).json({ message: 'Not authorized' });
                return;
            }

            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
                .update(body.toString())
                .digest('hex');

            if (expectedSignature === razorpay_signature) {
                // Payment verified, add 99 coins to school
                const school = await School.findById(req.user.schoolId);
                if (!school) {
                    res.status(404).json({ message: 'School not found' });
                    return;
                }

                const coinsBefore = school.coins || 0;
                school.coins = coinsBefore + 99;
                await school.save();

                // Log Transaction
                await Transaction.create({
                    schoolId: school._id,
                    type: 'purchase',
                    coins: 99,
                    amount: 99, // Base amount as requested
                    coinsBefore: coinsBefore,
                    coinsAfter: school.coins,
                    referenceId: razorpay_payment_id,
                    description: 'Credit purchase via Razorpay',
                });

                res.json({
                    message: 'Payment verified successfully and credits added!',
                    coins: school.coins
                });
            } else {
                res.status(400).json({ message: 'Invalid payment signature' });
            }
        } catch (error: any) {
            console.error('Verify payment error:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }
);

export default router;
