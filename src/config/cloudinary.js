// const cloudinary = require("cloudinary").v2;

// // Option 1: Use CLOUDINARY_URL (simplest method)
// if (process.env.CLOUDINARY_URL) {
//     cloudinary.config({
//         cloudinary_url: process.env.CLOUDINARY_URL,
//         secure: true,
//     });
//     console.log("✅ Cloudinary configured using CLOUDINARY_URL");
// } else {
//     // Option 2: Use individual credentials
//     const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
//     const apiKey = process.env.CLOUDINARY_API_KEY;
//     const apiSecret = process.env.CLOUDINARY_API_SECRET;

//     if (!cloudName || !apiKey || !apiSecret) {
//         console.error("\n❌ CLOUDINARY CREDENTIALS MISSING!");
//         console.error("Cloud Name:", cloudName || "MISSING");
//         console.error("API Key:", apiKey || "MISSING");
//         console.error("API Secret:", apiSecret ? "SET" : "MISSING");
//         throw new Error("Cloudinary credentials are not configured properly");
//     }

//     cloudinary.config({
//         cloud_name: cloudName,
//         api_key: apiKey,
//         api_secret: apiSecret,
//         secure: true,
//     });

//     console.log("✅ Cloudinary configured:");
//     console.log("   Cloud Name:", cloudName);
//     console.log("   API Key:", apiKey.substring(0, 5) + "...");
// }

// module.exports = cloudinary;


const cloudinary = require("cloudinary").v2;

if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
        cloudinary_url: process.env.CLOUDINARY_URL,
        secure: true,
    });
    console.log("✅ Cloudinary configured using CLOUDINARY_URL");
} else {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        console.error("\n❌ CLOUDINARY CREDENTIALS MISSING!");
        console.error("Cloud Name:", cloudName || "MISSING");
        console.error("API Key:", apiKey || "MISSING");
        console.error("API Secret:", apiSecret ? "SET" : "MISSING");
        throw new Error("Cloudinary credentials are not configured properly");
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    console.log("✅ Cloudinary configured:");
    console.log("   Cloud Name:", cloudName);
    console.log("   API Key:", apiKey.substring(0, 5) + "...");
}

module.exports = cloudinary;