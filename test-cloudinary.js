require("dotenv").config();
const cloudinary = require("./config/cloudinary");

async function testCloudinaryConnection() {
    console.log("\n🔍 Testing Cloudinary Configuration...\n");
    console.log("================================================");

    // Check environment variables
    console.log("📋 Environment Variables:");
    console.log("   CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME || "❌ NOT SET");
    console.log("   CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY || "❌ NOT SET");
    console.log("   CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "✅ SET" : "❌ NOT SET");
    console.log("================================================\n");

    // Test API connection
    try {
        console.log("🔌 Testing Cloudinary API connection...");
        const result = await cloudinary.api.ping();
        console.log("✅ SUCCESS! Cloudinary is connected properly.");
        console.log("📊 API Response:", result);
        console.log("\n✨ You're ready to upload images to Cloudinary!\n");
    } catch (error) {
        console.error("❌ FAILED! Cloudinary connection error:");
        console.error("   Error Message:", error.message);
        console.error("\n🔧 Troubleshooting:");
        console.error("   1. Check your .env file has correct credentials");
        console.error("   2. Make sure there are no extra spaces or quotes");
        console.error("   3. Verify credentials on cloudinary.com dashboard");
        console.error("   4. Restart your server after changing .env\n");
    }
}

testCloudinaryConnection();