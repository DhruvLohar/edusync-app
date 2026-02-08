const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);

const BLUETOOTH_LE_FEATURE =
  '<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />';
const WRITE_EXTERNAL_STORAGE_PERMISSION = 'android.permission.WRITE_EXTERNAL_STORAGE';

function insertBluetoothLeFeature() {
  try {
    // Check if manifest file exists
    if (!fs.existsSync(MANIFEST_PATH)) {
      console.log('⚠️  AndroidManifest.xml not found. Skipping...');
      return;
    }

    // Read the manifest file
    let manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf-8');

    // Check if bluetooth_le feature already exists
    if (manifestContent.includes('android.hardware.bluetooth_le')) {
      console.log('✅ Bluetooth LE feature already exists in AndroidManifest.xml');
      return;
    }

    // Find the WRITE_EXTERNAL_STORAGE permission line
    const lines = manifestContent.split('\n');
    let insertIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(WRITE_EXTERNAL_STORAGE_PERMISSION)) {
        insertIndex = i + 1;
        break;
      }
    }

    if (insertIndex === -1) {
      console.log(
        '⚠️  WRITE_EXTERNAL_STORAGE permission not found. Adding bluetooth_le feature at the end of permissions...'
      );

      // Find the last uses-permission tag instead
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('<uses-permission')) {
          insertIndex = i + 1;
          break;
        }
      }
    }

    if (insertIndex === -1) {
      console.log('❌ Could not find appropriate location to insert bluetooth_le feature');
      return;
    }

    // Insert the bluetooth_le feature with proper indentation
    const indentation = '  '; // Match the indentation in the manifest
    lines.splice(insertIndex, 0, '');
    lines.splice(insertIndex + 1, 0, `${indentation}${BLUETOOTH_LE_FEATURE}`);

    // Write back to file
    manifestContent = lines.join('\n');
    fs.writeFileSync(MANIFEST_PATH, manifestContent, 'utf-8');

    console.log('✅ Successfully added Bluetooth LE feature to AndroidManifest.xml');
  } catch (error) {
    console.error('❌ Error processing AndroidManifest.xml:', error);
    process.exit(1);
  }
}

// Run the function
insertBluetoothLeFeature();
