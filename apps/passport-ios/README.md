# Burnt Passport - Age Verification Demo

This demo showcases how to integrate **Zero Knowledge (ZK) Proof technology** to verify age (21+) through multiple verification providers.

## Overview

This React Native application demonstrates a streamlined approach to age verification that:

- **Protects user privacy** - Zero Knowledge Proofs verify age status without exposing sensitive personal information
- **Supports multiple providers** - Users can choose from various verification methods (Apple Wallet, Government ID, etc.)
- **Enables instant verification** - Once verified, the system immediately confirms 21+ status
- **Improves user experience** - Seamless verification flow through familiar identity sources

## How It Works

1. **Provider Selection**: Users choose their preferred verification method
2. **Identity Verification**: Users verify their identity through the selected provider (e.g., Apple Wallet digital ID)
3. **ZK Proof Generation**: The system generates cryptographic proofs that verify the user is 21+ without exposing their exact date of birth
4. **Instant Confirmation**: The verified age status is shared with the requesting application
5. **Session Update**: The TV/application receives confirmation that the user is verified 21+

## Key Benefits

- **Privacy First**: Only age verification status is shared, never personal details
- **No Document Storage**: ID documents and personal information remain private
- **Enhanced Privacy**: Users' sensitive information remains protected through ZK proofs
- **Better User Experience**: Streamlined flow with familiar verification methods
- **Flexible Providers**: Support for multiple verification sources

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- iOS Simulator (for iOS development) or Android Emulator (for Android development)
- Expo CLI (installed globally or via npx)

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   Create a `.env` file in the root directory with the following variables:

   ```
   EXPO_PUBLIC_RECLAIM_APP_ID=your_reclaim_app_id
   EXPO_PUBLIC_RECLAIM_APP_SECRET=your_reclaim_app_secret
   EXPO_PUBLIC_RECLAIM_PROVIDER_ID=your_reclaim_provider_id
   ```

3. Start the development server:

   ```bash
   npm run ios
   ```

   OR

   ```bash
   npm run android
   ```

## Questions or Support

For questions about this demo or integration support, please contact the development team.

---

**Note**: This is a demonstration application. Production implementation would require additional security measures, error handling, and integration with existing application processing systems.
