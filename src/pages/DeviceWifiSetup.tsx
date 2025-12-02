import { useState, useEffect } from 'react';
import { Button, Input, Alert, Card, Steps, Modal, List } from 'antd';
import { WifiOutlined, ScanOutlined, CheckCircleOutlined, LoadingOutlined, ApiOutlined } from '@ant-design/icons';
import { toast } from 'sonner';

interface BluetoothDevice {
  name: string;
  id: string;
  device: any;
}

interface WifiNetwork {
  ssid: string;
  rssi: number;
  security: string;
}

const DeviceWifiSetup = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [selectedSsid, setSelectedSsid] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>('');

  // Check if Web Bluetooth is supported
  useEffect(() => {
    if (!(navigator as any).bluetooth) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      if (isIOS) {
        setError('⚠️ Web Bluetooth is not supported on iOS devices. Please use an Android device with Chrome, Edge, or Opera browser.');
      } else if (isAndroid) {
        setError('Web Bluetooth is not supported in this browser. Please open this page in Chrome, Edge, or Opera on your Android device.');
      } else {
        setError('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
      }
    }
  }, []);

  // Step 1: Scan for Bluetooth devices
  const scanForDevices = async () => {
    try {
      setScanning(true);
      setError('');
      
      // Check if Web Bluetooth is supported
      if (!(navigator as any).bluetooth) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
          toast.error('Web Bluetooth is not supported on iOS. Please use an Android device with Chrome.', {
            duration: 6000
          });
        } else if (isAndroid) {
          toast.error('Please open this page in Chrome, Edge, or Opera browser.', {
            duration: 5000
          });
        } else {
          toast.error('Web Bluetooth is not supported. Please use Chrome, Edge, or Opera.', {
            duration: 5000
          });
        }
        setScanning(false);
        return;
      }
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '00001234-0000-1000-8000-00805f9b34fb',
          'battery_service',
          'device_information'
        ]
      });

      if (device) {
        const bluetoothDevice: BluetoothDevice = {
          name: device.name || 'Unnamed Device',
          id: device.id,
          device: device
        };
        
        setSelectedDevice(bluetoothDevice);
        toast.success(`Selected: ${bluetoothDevice.name}`);
        
        // Automatically connect and scan for Wi-Fi
        await connectToDevice(bluetoothDevice);
      }
    } catch (err: any) {
      console.error('Bluetooth scan error:', err);
      if (err.message.includes('User cancelled') || err.name === 'NotFoundError') {
        toast.error('Device selection cancelled');
      } else {
        setError(`Failed to scan for devices: ${err.message}`);
        toast.error('Failed to scan for devices');
      }
    } finally {
      setScanning(false);
    }
  };

  // Step 2: Connect to selected device and fetch Wi-Fi networks
  const connectToDevice = async (device?: BluetoothDevice) => {
    const targetDevice = device || selectedDevice;
    if (!targetDevice) return;

    try {
      setConnecting(true);
      setError('');
      setCurrentStep(1);

      const server = await targetDevice.device.gatt.connect();
      toast.success('Connected to device');

      // Get the custom Tipply service
      const service = await server.getPrimaryService('00001234-0000-1000-8000-00805f9b34fb');
      
      // Get the Wi-Fi scan characteristic
      const wifiScanCharacteristic = await service.getCharacteristic('00001235-0000-1000-8000-00805f9b34fb');
      
      // Request Wi-Fi scan
      await wifiScanCharacteristic.writeValue(new TextEncoder().encode('SCAN'));
      
      // Wait a bit for scan to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Read the Wi-Fi networks
      const networksData = await wifiScanCharacteristic.readValue();
      const networksJson = new TextDecoder().decode(networksData);
      const networks = JSON.parse(networksJson);
      
      setWifiNetworks(networks);
      setShowWifiModal(true);
      setCurrentStep(2);
      toast.success(`Found ${networks.length} Wi-Fi networks`);
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(`Failed to connect: ${err.message}`);
      toast.error('Failed to connect to device');
    } finally {
      setConnecting(false);
    }
  };

  // Select Wi-Fi network from modal
  const selectWifiNetwork = (ssid: string) => {
    setSelectedSsid(ssid);
    setShowWifiModal(false);
  };

  // Step 3: Send Wi-Fi credentials to device
  const configureWifi = async () => {
    if (!selectedDevice || !selectedSsid || !password) {
      toast.error('Please enter Wi-Fi password');
      return;
    }

    try {
      setConnecting(true);
      setError('');

      const server = await selectedDevice.device.gatt.connect();
      const service = await server.getPrimaryService('00001234-0000-1000-8000-00805f9b34fb');
      
      // Get the Wi-Fi config characteristic
      const wifiConfigCharacteristic = await service.getCharacteristic('00001236-0000-1000-8000-00805f9b34fb');
      
      // Send credentials
      const credentials = JSON.stringify({ ssid: selectedSsid, password });
      await wifiConfigCharacteristic.writeValue(new TextEncoder().encode(credentials));
      
      // Wait for connection confirmation
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Read connection status
      const statusCharacteristic = await service.getCharacteristic('00001237-0000-1000-8000-00805f9b34fb');
      const statusData = await statusCharacteristic.readValue();
      const status = new TextDecoder().decode(statusData);
      
      if (status === 'CONNECTED') {
        setConnected(true);
        setCurrentStep(3);
        toast.success('Tipply device connected to Wi-Fi!');
      } else {
        throw new Error('Connection failed: ' + status);
      }
    } catch (err: any) {
      console.error('Wi-Fi configuration error:', err);
      setError(`Failed to configure Wi-Fi: ${err.message}`);
      toast.error('Failed to configure Wi-Fi');
    } finally {
      setConnecting(false);
    }
  };

  const steps = [
    {
      title: 'Scan',
      icon: <ScanOutlined />,
      description: 'Find your Tipply device'
    },
    {
      title: 'Connect',
      icon: <WifiOutlined />,
      description: 'Connect via Bluetooth'
    },
    {
      title: 'Configure',
      icon: <WifiOutlined />,
      description: 'Select Wi-Fi network'
    },
    {
      title: 'Complete',
      icon: <CheckCircleOutlined />,
      description: 'Setup complete'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Tipply Device Setup
          </h1>
          <p className="text-gray-300 text-lg">
            Connect your Tipply device to Wi-Fi via Bluetooth
          </p>
        </div>

        {/* Progress Steps */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <style>{`
            .ant-steps-item-title {
              color: white !important;
            }
            .ant-steps-item-description {
              color: #D1D5DB !important;
            }
            .ant-steps-item-wait .ant-steps-item-icon {
              background-color: #374151 !important;
              border-color: #4B5563 !important;
            }
            .ant-steps-item-wait .ant-steps-item-icon .ant-steps-icon {
              color: #9CA3AF !important;
            }
            .ant-input-password input {
              background-color: #374151 !important;
              color: white !important;
              border-color: #4B5563 !important;
            }
            .ant-input-password input:focus {
              background-color: #374151 !important;
              color: white !important;
              border-color: #3B82F6 !important;
            }
            .ant-input-password input::placeholder {
              color: #9CA3AF !important;
            }
            .ant-input-affix-wrapper {
              background-color: #374151 !important;
              border-color: #4B5563 !important;
            }
            .ant-input-affix-wrapper:focus,
            .ant-input-affix-wrapper-focused {
              background-color: #374151 !important;
              border-color: #3B82F6 !important;
            }
            .ant-input-password .ant-input-suffix {
              color: #9CA3AF !important;
            }
          `}</style>
          <Steps 
            current={currentStep} 
            items={steps}
          />
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            closable
            onClose={() => setError('')}
            className="mb-6"
          />
        )}

        {/* Step 0: Scan for Devices */}
        {currentStep === 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <div className="text-center py-8">
              <ApiOutlined className="text-6xl text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">
                Scan for Tipply Device
              </h2>
              <p className="text-gray-300 mb-6">
                Make sure your Tipply device is powered on and in pairing mode
              </p>
              <Button
                type="primary"
                size="large"
                icon={scanning ? <LoadingOutlined /> : <ScanOutlined />}
                onClick={scanForDevices}
                loading={scanning}
                disabled={!!error && error.includes('not supported')}
                className="bg-blue-600 hover:bg-blue-700 border-none px-8"
              >
                {scanning ? 'Scanning...' : 'Scan for Devices'}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 1: Connecting */}
        {currentStep === 1 && connecting && (
          <Card className="bg-gray-800 border-gray-700">
            <div className="text-center py-8">
              <LoadingOutlined className="text-6xl text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">
                Connecting to Device
              </h2>
              <p className="text-gray-300 mb-6">
                Scanning for available Wi-Fi networks...
              </p>
            </div>
          </Card>
        )}

        {/* Step 2: Enter Wi-Fi Password */}
        {currentStep === 2 && selectedSsid && (
          <Card className="bg-gray-800 border-gray-700">
            <div className="py-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Enter Wi-Fi Password
              </h2>
              
              <div className="space-y-4 mb-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <label className="block text-gray-300 text-sm mb-2">
                    Selected Network
                  </label>
                  <div className="flex items-center justify-between">
                    <p className="text-white font-semibold text-lg">
                      {selectedSsid}
                    </p>
                    <Button
                      type="link"
                      onClick={() => setShowWifiModal(true)}
                      className="text-blue-400"
                    >
                      Change
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-2">
                    Password
                  </label>
                  <Input.Password
                    size="large"
                    placeholder="Enter Wi-Fi password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onPressEnter={configureWifi}
                    className="bg-gray-700 border-gray-600 text-white [&_input]:bg-gray-700 [&_input]:text-white [&_input::placeholder]:text-gray-400"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="default"
                  size="large"
                  onClick={() => {
                    setCurrentStep(0);
                    setSelectedDevice(null);
                    setWifiNetworks([]);
                    setSelectedSsid('');
                    setPassword('');
                  }}
                  className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={connecting ? <LoadingOutlined /> : <CheckCircleOutlined />}
                  onClick={configureWifi}
                  loading={connecting}
                  disabled={!password}
                  className="flex-1 bg-green-600 hover:bg-green-700 border-none"
                >
                  {connecting ? 'Connecting...' : 'Connect to Wi-Fi'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Success */}
        {currentStep === 3 && connected && (
          <Card className="bg-gray-800 border-gray-700">
            <div className="text-center py-8">
              <CheckCircleOutlined className="text-6xl text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">
                Setup Complete!
              </h2>
              <p className="text-gray-300 mb-6">
                Your Tipply device is now connected to Wi-Fi
              </p>
              <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <p className="text-white font-semibold">
                  Network: {selectedSsid}
                </p>
              </div>
              <Button
                type="primary"
                size="large"
                onClick={() => window.location.href = '/dashboard'}
                className="bg-blue-600 hover:bg-blue-700 border-none px-8"
              >
                Go to Dashboard
              </Button>
            </div>
          </Card>
        )}

        {/* Browser Support Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Web Bluetooth requires Chrome, Edge, or Opera browser on desktop or Android
          </p>
        </div>
      </div>

      {/* Wi-Fi Networks Modal */}
      <Modal
        title={<span className="text-white">Select Wi-Fi Network</span>}
        open={showWifiModal}
        onCancel={() => setShowWifiModal(false)}
        footer={null}
        width={500}
        styles={{
          content: { backgroundColor: '#1f2937' },
          header: { backgroundColor: '#1f2937', borderBottom: '1px solid #374151' }
        }}
      >
        <List
          dataSource={wifiNetworks}
          renderItem={(network) => (
            <List.Item
              onClick={() => selectWifiNetwork(network.ssid)}
              className="cursor-pointer hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors"
              style={{ borderBottom: '1px solid #374151' }}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <WifiOutlined className="text-blue-400 text-xl" />
                  <span className="text-white font-medium">{network.ssid}</span>
                </div>
                <span className="text-gray-400 text-sm">
                  {network.rssi} dBm
                </span>
              </div>
            </List.Item>
          )}
          className="max-h-96 overflow-y-auto"
        />
      </Modal>
    </div>
  );
};

export default DeviceWifiSetup;
