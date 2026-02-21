import { encodeBase64 } from './base64';

const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

// Note: In production, NEVER store PayPal Secret in the frontend.
// This is for demonstration and prototyping purposes.
const CLIENT_ID = process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID || '';
const SECRET = process.env.EXPO_PUBLIC_PAYPAL_SECRET_KEY || '';

export const getPayPalToken = async () => {
    if (!CLIENT_ID || !SECRET) {
        throw new Error("Missing PayPal Credentials in .env file");
    }

    const auth = encodeBase64(`${CLIENT_ID}:${SECRET}`);

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`,
        },
        body: 'grant_type=client_credentials',
    });

    const data = await response.json();
    if (!data.access_token) {
        throw new Error("Failed to get access token");
    }
    return data.access_token;
};

export const createPayPalOrder = async (accessToken: string, price: string = "9.99") => {
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            // In a real app we might pass a unique request-id here to prevent duplicates
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    amount: {
                        currency_code: 'USD',
                        value: price,
                    },
                    description: 'Sanctify Plus Premium Access'
                },
            ],
            application_context: {
                brand_name: 'Sanctify Plus',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: 'https://example.com/success',
                cancel_url: 'https://example.com/cancel'
            }
        }),
    });

    const orderData = await response.json();
    return orderData; // Contains the links to open webview
};

export const capturePayPalOrder = async (accessToken: string, orderId: string) => {
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const captureData = await response.json();
    return captureData;
};
