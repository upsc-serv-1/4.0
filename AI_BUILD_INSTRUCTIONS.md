# AI Build & Deployment Instructions

Hello fellow AI Agent! When the user asks you to "push" or "build", please STRICTLY follow the established workflow rules for this project below to avoid breaking the deployment pipelines.

## 1. Pushing Code (The 10.2 -> 10.3 Sync Rule)
All active development occurs on the **`10.2`** branch. The **`10.3`** branch must always be kept perfectly in sync with `10.2`.
When the user asks to push changes:
1. `git checkout 10.2` (ensure you are on the primary branch)
2. `git add .` (or specific files) and `git commit -m "..."`
3. `git push origin 10.2`
4. **Always sync to 10.3:**
   ```bash
   git checkout 10.3
   git pull origin 10.3
   git merge 10.2
   git push origin 10.3
   git checkout 10.2
   ```

## 2. Building Android (APK via EAS)
We use Expo Application Services (EAS) to build the Android APK. 
To build Android, simply run this command from the project root:
```bash
npx eas-cli build --platform android --profile preview --non-interactive
```
*Note: We specifically use the `preview` profile because it is configured in `eas.json` to generate an `.apk` file instead of an `.aab` file.*

## 3. Building iOS (IPA via GitHub Actions)
To save GitHub Action minutes, the iOS build workflow (`.github/workflows/build-ios.yml`) is set to manual (`workflow_dispatch`). However, to trigger it programmatically without requiring the user to use the GitHub UI, you must temporarily enable push triggers.

To build iOS:
1. Temporarily add the following lines to `.github/workflows/build-ios.yml` under `on:`
   ```yaml
   on:
     workflow_dispatch:
     push:
       branches:
         - 10.2
   ```
2. Commit your code changes *along with* the modified `build-ios.yml` file, and push to `10.2`. **This push will trigger the iOS build.**
3. Immediately revert `build-ios.yml` back to its original state (removing the push trigger).
4. Commit the revert and push to `10.2`.
5. Sync everything to `10.3` as outlined in step 1.

*Note: The GitHub Action will compile an **unsigned IPA** (bypassing code signing) and attach it as an artifact on the GitHub Actions dashboard.*

## V2 Standalone App Instructions
There is a separate branch named `clone-version-2` which contains identical code but uses a different bundle identifier (`com.dryogesh.drupscv2`) so the user can install it side-by-side as "Dr. UPSC V2".
If asked to build V2:
1. Checkout `clone-version-2`.
2. Merge `10.2` into it so it has the latest code (`git merge 10.2`).
3. Follow the same iOS and Android build steps above, but ensure you push/trigger on the `clone-version-2` branch instead of `10.2`.
4. Switch back to `10.2` when done.
