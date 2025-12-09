/**
 * Tipwave Device WiFi Setup Component
 * 
 * Bluetooth Specification:
 * - Device Name: Tipwave-<serial_number> (e.g., Tipwave-TPW-5C07-3VQ)
 * 
 * Service and Characteristics:
 * - Provisioning Service: 550e8400-e29b-41d4-a716-446655440000
 * - WiFi Scan Characteristic: 550e8400-e29b-41d4-a716-446655440004 (Read/Notify)
 * - SSID Characteristic:    550e8400-e29b-41d4-a716-446655440001 (Write-only)
 * - Password Characteristic: 550e8400-e29b-41d4-a716-446655440002 (Write-only)
 * - Status Characteristic:   550e8400-e29b-41d4-a716-446655440003 (Notify-only)
 * 
 * WiFi Scan JSON Format:
 * - [{"ssid":"Network1","rssi":-45,"security":"WPA2"},{"ssid":"Network2","rssi":-67,"security":"Open"}]
 * 
 * Status JSON Format:
 * - {"state":"connecting"}
 * - {"state":"success","ip":"192.168.x.x"}
 * - {"state":"failure","error":"auth_failed|no_ssid|timeout|unknown"}
 */

import { useState, useEffect } from 'react';
import { Button, Input, Alert, Card, Steps, Modal, List } from 'antd';
import { WifiOutlined, ScanOutlined, CheckCircleOutlined, LoadingOutlined, ApiOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';

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

interface EnvironmentInfo {
  isPWA: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  browser: string;
  supportsWebBluetooth: boolean;
  supportsNotifications: boolean;
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
  const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [demoMode, setDemoMode] = useState(false);

  // Detect environment and capabilities
  const detectEnvironment = (): EnvironmentInfo => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isMobile = isIOS || isAndroid || /Mobile/.test(userAgent);
    const isDesktop = !isMobile;
    
    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://');
    
    // Detect browser
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    else if (userAgent.includes('Opera')) browser = 'Opera';
    
    const supportsWebBluetooth = !!(navigator as any).bluetooth;
    const supportsNotifications = 'Notification' in window;
    
    return {
      isPWA,
      isIOS,
      isAndroid,
      isMobile,
      isDesktop,
      browser,
      supportsWebBluetooth,
      supportsNotifications
    };
  };

  // Initialize environment detection
  useEffect(() => {
    const env = detectEnvironment();
    setEnvironment(env);
    
    // Check notification permission status
    if (env.supportsNotifications) {
      setNotificationPermission(Notification.permission);
    }
    
    // Set appropriate error message based on environment
    if (!env.supportsWebBluetooth) {
      if (env.isIOS) {
        setError('⚠️ Web Bluetooth is not supported on iOS. Please use an Android device with Chrome, Edge, or Opera, or install the Tipply PWA wrapper.');
      } else if (env.isAndroid) {
        setError(`Web Bluetooth is not supported in ${env.browser}. Please open this page in Chrome, Edge, or Opera on your Android device.`);
      } else {
        setError('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
      }
    }
  }, []);

  // Request Bluetooth permission (triggered on "Find my device" button)
  const requestBluetoothPermission = async (): Promise<boolean> => {
    if (!(navigator as any).bluetooth) {
      return false;
    }
    
    try {
      // Bluetooth permission is requested implicitly through requestDevice
      // This is just a pre-check
      return true;
    } catch (err) {
      console.error('Bluetooth permission check failed:', err);
      return false;
    }
  };

  // Request Notification permission (triggered after successful provisioning)
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission === 'denied') {
      toast.info('Notifications are blocked. Enable them in browser settings to get setup alerts.');
      return false;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        toast.success('Notifications enabled! You\'ll be alerted when setup completes.');
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error('Notification permission error:', err);
      return false;
    }
  };

  // Send notification
  const sendNotification = (title: string, body: string, success: boolean = true) => {
    if (Notification.permission === 'granted') {
      const options: any = {
        body,
        icon: success ? '/images/5dollars.png' : '/images/1dollar.png',
        badge: '/images/1dollar.png',
        tag: 'tipply-setup'
      };
      
      // Add vibrate if supported (non-standard property)
      if ('vibrate' in navigator) {
        options.vibrate = success ? [200, 100, 200] : [100];
      }
      
      new Notification(title, options);
    }
  };

  // Step 1: Scan for Bluetooth devices
  const scanForDevices = async () => {
    try {
      setScanning(true);
      setError('');
      
      // Request Bluetooth permission first
      const hasBluetoothAccess = await requestBluetoothPermission();
      
      if (!hasBluetoothAccess || !(navigator as any).bluetooth) {
        if (environment?.isIOS) {
          toast.error('🚫 Provisioning requires desktop or Tipply PWA wrapper. iOS Safari does not support Web Bluetooth.', {
            duration: 6000
          });
        } else if (environment?.isAndroid) {
          toast.error(`Please open this page in Chrome, Edge, or Opera browser on Android.`, {
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
      
      // Check for demo mode (hold Shift key while clicking) - Only in development
      if (import.meta.env.DEV && (window.event as any)?.shiftKey) {
        setDemoMode(true);
        toast.info('Demo mode activated - simulating Tipwave device');
        
        // Simulate device selection
        const demoDevice: BluetoothDevice = {
          name: 'Tipwave-TPW-DEMO-001',
          id: 'demo-device-001',
          device: null
        };
        
        setSelectedDevice(demoDevice);
        toast.success(`Selected: ${demoDevice.name} (Demo)`);
        
        // Simulate connection with delay
        setTimeout(() => {
          connectToDevice(demoDevice);
        }, 1000);
        
        return;
      }
      
      toast.info('Opening Bluetooth device picker...');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          {
            namePrefix: 'Tipwave-'
          }
        ],
        optionalServices: [
          '550e8400-e29b-41d4-a716-446655440000', // Provisioning Service
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
        toast.error('Device selection cancelled. No Tipwave devices found nearby.');
        if (import.meta.env.DEV) {
          toast.info('💡 Hold Shift key while clicking "Find My Device" to test in demo mode');
        }
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

      // Demo mode simulation - Only in development
      if (import.meta.env.DEV && (demoMode || !targetDevice.device)) {
        toast.info('Demo mode: Simulating device connection...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast.success('Connected to device (Demo)');
        
        // Skip WiFi scanning in demo mode - go straight to manual entry
        setCurrentStep(2);
        toast.info('Enter your WiFi credentials (Demo)');
        setConnecting(false);
        return;
      }

      const server = await targetDevice.device.gatt.connect();
      toast.success('Connected to device');

      // Get the Tipwave Provisioning Service (will be used in configureWifi)
      await server.getPrimaryService('550e8400-e29b-41d4-a716-446655440000');
      
      // TODO: WiFi scanning will be implemented later when firmware supports characteristic 550e8400-e29b-41d4-a716-446655440004
      // For now, skip directly to manual SSID entry
      
      setCurrentStep(2);
      toast.info('Enter your WiFi network credentials');
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
      toast.error('Please enter WiFi network name and password');
      return;
    }

    try {
      setConnecting(true);
      setError('');

      // Demo mode simulation - Only in development
      if (import.meta.env.DEV && (demoMode || !selectedDevice.device)) {
        toast.info('Demo mode: Sending credentials to device...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        toast.info('Device is connecting to WiFi...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Simulate success
        setConnected(true);
        setCurrentStep(3);
        const mockIp = '192.168.1.157';
        toast.success(`✅ Tipwave device connected to WiFi! IP: ${mockIp} (Demo)`);
        
        const notifGranted = await requestNotificationPermission();
        if (notifGranted) {
          sendNotification(
            '✅ Setup Complete!', 
            `Your Tipwave device is now connected to ${selectedSsid} (Demo Mode)`,
            true
          );
        }
        
        setConnecting(false);
        return;
      }

      const server = await selectedDevice.device.gatt.connect();
      const service = await server.getPrimaryService('550e8400-e29b-41d4-a716-446655440000');
      
      // Get the SSID characteristic (write-only)
      const ssidCharacteristic = await service.getCharacteristic('550e8400-e29b-41d4-a716-446655440001');
      
      // Get the Password characteristic (write-only)
      const passwordCharacteristic = await service.getCharacteristic('550e8400-e29b-41d4-a716-446655440002');
      
      // Get the Status characteristic (notify-only)
      const statusCharacteristic = await service.getCharacteristic('550e8400-e29b-41d4-a716-446655440003');
      
      // Write SSID
      await ssidCharacteristic.writeValue(new TextEncoder().encode(selectedSsid));
      toast.info('SSID sent to device');
      
      // Write Password
      await passwordCharacteristic.writeValue(new TextEncoder().encode(password));
      toast.info('Password sent to device');
      
      // Enable notifications for status updates
      await statusCharacteristic.startNotifications();
      
      // Listen for status updates
      statusCharacteristic.addEventListener('characteristicvaluechanged', async (event: any) => {
        const statusData = event.target.value;
        const statusJson = new TextDecoder().decode(statusData);
        
        try {
          const status = JSON.parse(statusJson);
          console.log('Status update:', status);
          
          if (status.state === 'connecting') {
            toast.info('Device is connecting to WiFi...');
          } else if (status.state === 'success') {
            setConnected(true);
            setCurrentStep(3);
            const ipAddress = status.ip || 'network';
            toast.success(`✅ Tipwave device connected to WiFi! IP: ${ipAddress}`);
            
            // Request notification permission after successful provisioning
            const notifGranted = await requestNotificationPermission();
            if (notifGranted) {
              sendNotification(
                '✅ Setup Complete!', 
                `Your Tipwave device is now connected to ${selectedSsid} (IP: ${ipAddress})`,
                true
              );
            }
            
            // Stop notifications
            await statusCharacteristic.stopNotifications();
            setConnecting(false);
          } else if (status.state === 'failure') {
            const errorMsg = getErrorMessage(status.error);
            throw new Error(errorMsg);
          }
        } catch (parseErr) {
          console.error('Failed to parse status JSON:', parseErr);
        }
      });
      
      toast.info('Waiting for device to connect to WiFi...');
      
      // Set a timeout in case we don't get a response
      setTimeout(() => {
        if (connecting) {
          setConnecting(false);
          toast.error('Connection timeout. Please try again.');
        }
      }, 30000); // 30 second timeout
      
    } catch (err: any) {
      console.error('Wi-Fi configuration error:', err);
      setError(`Failed to configure Wi-Fi: ${err.message}`);
      toast.error(`Failed to configure Wi-Fi: ${err.message}`);
      
      // Send failure notification if permission granted
      if (notificationPermission === 'granted') {
        sendNotification(
          '❌ Setup Failed',
          'Tipwave device could not connect to Wi-Fi. Please try again.',
          false
        );
      }
      
      setConnecting(false);
    }
  };
  
  // Helper function to get user-friendly error messages
  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth_failed':
        return 'Wrong WiFi password. Please check and try again.';
      case 'no_ssid':
        return 'WiFi network not found. Make sure the network name is correct.';
      case 'timeout':
        return 'Connection attempt timed out. Please try again.';
      case 'unknown':
      default:
        return 'Connection failed. Please try again.';
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
      description: 'Enter WiFi credentials'
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
          <div className="flex items-center justify-center gap-3 mb-3">
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Tipwave Device Setup
            </h1>
            {import.meta.env.DEV && demoMode && (
              <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-xs font-semibold">
                DEMO MODE
              </span>
            )}
          </div>
          <p className="text-gray-300 text-lg">
            Connect your Tipwave device to WiFi via Bluetooth
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Looking for devices named: <span className="text-blue-400 font-mono">Tipwave-*</span>
          </p>
          {!demoMode && import.meta.env.DEV && (
            <p className="text-yellow-400 text-xs mt-2">
              💡 No hardware? Hold <kbd className="bg-gray-700 px-2 py-1 rounded">Shift</kbd> while clicking "Find My Device" to test demo mode
            </p>
          )}
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

        {/* Environment Info Banner */}
        {environment && (
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {environment.isMobile ? <MobileOutlined className="text-blue-400 text-xl" /> : <DesktopOutlined className="text-blue-400 text-xl" />}
                <div>
                  <p className="text-white font-medium">
                    {environment.isPWA ? '📱 Running as PWA' : environment.isMobile ? '📱 Mobile Browser' : '💻 Desktop Browser'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {environment.browser} • {environment.supportsWebBluetooth ? '✅ Bluetooth Ready' : '❌ No Bluetooth'} • {environment.supportsNotifications ? '🔔 Notifications Available' : '🔕 No Notifications'}
                  </p>
                </div>
              </div>
              {environment.isPWA && (
                <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold">
                  PWA Mode
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            message="Setup Requirements"
            description={error}
            type="warning"
            closable
            onClose={() => setError('')}
            className="mb-6"
            showIcon
          />
        )}

        {/* Step 0: Scan for Devices */}
        {currentStep === 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <div className="text-center py-8">
              <ApiOutlined className="text-6xl text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">
                Scan for Tipwave Device
              </h2>
              <p className="text-gray-300 mb-6">
                Make sure your Tipwave device is powered on and in pairing mode
              </p>
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                <p className="text-blue-200 text-sm mb-2">
                  <strong>Device Name Format:</strong>
                </p>
                <p className="text-blue-100 text-sm font-mono">
                  Tipwave-&lt;serial_number&gt;
                </p>
                <p className="text-blue-200 text-xs mt-2">
                  Example: Tipwave-TPW-5C07-3VQ
                </p>
              </div>
              <div className="flex flex-col gap-3 items-center">
                <Button
                  type="primary"
                  size="large"
                  icon={scanning ? <LoadingOutlined /> : <ScanOutlined />}
                  onClick={scanForDevices}
                  loading={scanning}
                  disabled={!environment?.supportsWebBluetooth}
                  className="bg-blue-600 hover:bg-blue-700 border-none px-8"
                >
                  {scanning ? 'Scanning...' : 'Find My Device'}
                </Button>
                
                {/* Demo Mode Button - Only visible in development */}
                {import.meta.env.DEV && (
                  <>
                    <div className="text-gray-400 text-sm">or</div>
                    
                    <Button
                      type="default"
                      size="large"
                      onClick={async () => {
                        // Activate demo mode directly
                        setScanning(true);
                        setDemoMode(true);
                        toast.info('Demo mode activated - simulating Tipwave device');
                        
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Simulate device selection
                        const demoDevice: BluetoothDevice = {
                          name: 'Tipwave-TPW-DEMO-001',
                          id: 'demo-device-001',
                          device: null
                        };
                        
                        setSelectedDevice(demoDevice);
                        toast.success(`Selected: ${demoDevice.name} (Demo)`);
                        
                        // Simulate connection with delay
                        setTimeout(() => {
                          connectToDevice(demoDevice);
                          setScanning(false);
                        }, 1000);
                      }}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white border-none px-8"
                    >
                      🧪 Test Demo Mode
                    </Button>
                  </>
                )}
              </div>
              
              {!environment?.supportsWebBluetooth && (
                <p className="text-yellow-400 mt-4 text-sm">
                  🚫 Provisioning requires desktop or Tipply PWA wrapper
                </p>
              )}
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
                Establishing Bluetooth connection...
              </p>
            </div>
          </Card>
        )}

        {/* Step 2: Enter WiFi Credentials */}
        {currentStep === 2 && (
          <Card className="bg-gray-800 border-gray-700">
            <div className="py-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Enter WiFi Credentials
              </h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-gray-300 font-semibold mb-2">
                    WiFi Network Name (SSID)
                  </label>
                  <Input
                    size="large"
                    placeholder="Enter your WiFi network name"
                    value={selectedSsid}
                    onChange={(e) => setSelectedSsid(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                    style={{ backgroundColor: '#374151', color: 'white', borderColor: '#4B5563' }}
                    autoFocus
                  />
                  <p className="text-gray-400 text-xs mt-1">
                    Enter the exact name of your WiFi network (case-sensitive)
                  </p>
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
                  disabled={!selectedSsid || !password}
                  className="flex-1 bg-green-600 hover:bg-green-700 border-none"
                >
                  {connecting ? 'Connecting...' : 'Connect to WiFi'}
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
                Your Tipwave device is now connected to WiFi
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

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
};

export default DeviceWifiSetup;
