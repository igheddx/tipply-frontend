import { useState } from 'react';
import { Button, Modal } from 'antd';
import { DownloadOutlined, CloseOutlined, ShareAltOutlined, PlusOutlined } from '@ant-design/icons';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallPrompt = () => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (isInstallable) {
      const installed = await promptInstall();
      if (!installed) {
        setDismissed(true);
      }
    }
  };

  return (
    <>
      {/* Install Banner */}
      {(isInstallable || isIOS) && !dismissed && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-2xl p-4 relative">
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-2 right-2 text-white/80 hover:text-white"
            >
              <CloseOutlined />
            </button>
            
            <div className="pr-6">
              <h3 className="text-white font-bold text-lg mb-1">
                Install Tipply App
              </h3>
              <p className="text-white/90 text-sm mb-3">
                {isIOS 
                  ? 'Add to your home screen for quick access'
                  : 'Install the app for a better experience'}
              </p>
              <Button
                type="primary"
                icon={isIOS ? <ShareAltOutlined /> : <DownloadOutlined />}
                onClick={handleInstallClick}
                className="bg-white text-blue-600 hover:bg-gray-100 border-none font-semibold"
                block
              >
                {isIOS ? 'View Instructions' : 'Install Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Installation Instructions Modal */}
      <Modal
        open={showIOSInstructions}
        onCancel={() => setShowIOSInstructions(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowIOSInstructions(false)}>
            Got it!
          </Button>
        ]}
        title="Install Tipply on iOS"
        centered
      >
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full p-2 mt-1">
              <ShareAltOutlined className="text-blue-600 text-xl" />
            </div>
            <div>
              <p className="font-semibold mb-1">1. Tap the Share button</p>
              <p className="text-gray-600 text-sm">
                Tap the share icon <ShareAltOutlined className="text-blue-600" /> at the bottom of Safari
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full p-2 mt-1">
              <PlusOutlined className="text-blue-600 text-xl" />
            </div>
            <div>
              <p className="font-semibold mb-1">2. Add to Home Screen</p>
              <p className="text-gray-600 text-sm">
                Scroll down and select "Add to Home Screen"
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full p-2 mt-1">
              <DownloadOutlined className="text-blue-600 text-xl" />
            </div>
            <div>
              <p className="font-semibold mb-1">3. Install</p>
              <p className="text-gray-600 text-sm">
                Tap "Add" in the top right corner
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>⚠️ Note:</strong> iOS does not support Web Bluetooth. Device setup features will not work on iOS. Please use an Android device for device configuration.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
