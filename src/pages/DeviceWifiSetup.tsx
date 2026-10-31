import logger from "../utils/logger";
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

import { useState, useEffect, useRef } from 'react';
import { Banner, Button, Card, Modal, useFeedback } from '../components/ui';
import { BrandIcon, IconTile, type BrandIconName } from '../components/icons/BrandIcons';
import { toast } from 'sonner';
import { wifiVault, type SavedNetwork } from '../utils/savedWifi';

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

/** Where the setup time went, in milliseconds */
interface SetupTimings {
  bluetoothMs?: number;
  sendMs?: number;
  joinMs?: number;
}

const PROVISIONING_SERVICE = '550e8400-e29b-41d4-a716-446655440000';
const SSID_CHAR = '550e8400-e29b-41d4-a716-446655440001';
const PASSWORD_CHAR = '550e8400-e29b-41d4-a716-446655440002';
const STATUS_CHAR = '550e8400-e29b-41d4-a716-446655440003';
// How long to wait for the device to report that it joined the Wi-Fi
const JOIN_TIMEOUT_MS = 45000;

interface ProvisioningLink {
  ssid: any;
  password: any;
  status: any;
}

const seconds = (ms?: number) => (ms == null ? '' : `${(ms / 1000).toFixed(1)} s`);

interface EnvironmentInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  browser: string;
  supportsWebBluetooth: boolean;
  supportsNotifications: boolean;
}

const DeviceWifiSetup = () => {
  const { toast: showError } = useFeedback();
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
  const [savedNetworks, setSavedNetworks] = useState<SavedNetwork[]>([]);
  const [remember, setRemember] = useState(true);
  const [phase, setPhase] = useState<'sending' | 'joining' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  // What the device reported when it could not join, kept so it can be copied and sent for help
  const [failure, setFailure] = useState<{ code: string; message: string; details: string } | null>(null);
  const [timings, setTimings] = useState<SetupTimings>({});
  // The Bluetooth link is opened and its characteristics looked up once, while the performer types
  const linkRef = useRef<ProvisioningLink | null>(null);
  const bluetoothMsRef = useRef<number | undefined>(undefined);

  // Detect environment and capabilities
  const detectEnvironment = (): EnvironmentInfo => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isMobile = isIOS || isAndroid || /Mobile/.test(userAgent);
    const isDesktop = !isMobile;
    
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
        setError('⚠️ Web Bluetooth is not supported on iOS. Please use an Android device with Chrome, Edge, or Opera.');
      } else if (env.isAndroid) {
        setError(`Web Bluetooth is not supported in ${env.browser}. Please open this page in Chrome, Edge, or Opera on your Android device.`);
      } else {
        setError('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
      }
    }
  }, []);

  useEffect(() => {
    wifiVault.list().then(setSavedNetworks);
  }, []);

  // Seconds since the credentials were sent, so a wait never looks frozen
  useEffect(() => {
    if (!phase) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [phase]);

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
      logger.error('Bluetooth permission check failed:', err);
      return false;
    }
  };

  // Request Notification permission (triggered after successful provisioning)
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      logger.log('Notifications not supported');
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
      logger.error('Notification permission error:', err);
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
          showError('🚫 Provisioning requires desktop or Android Chrome/Edge/Opera. iOS Safari does not support Web Bluetooth.', 'error');
        } else if (environment?.isAndroid) {
          showError(`Please open this page in Chrome, Edge, or Opera browser on Android.`, 'error');
        } else {
          showError('Web Bluetooth is not supported. Please use Chrome, Edge, or Opera.', 'error');
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
      logger.error('Bluetooth scan error:', err);
      if (err.message.includes('User cancelled') || err.name === 'NotFoundError') {
        showError('Device selection cancelled. No Tipwave devices found nearby.', 'error');
        if (import.meta.env.DEV) {
          toast.info('💡 Hold Shift key while clicking "Find My Device" to test in demo mode');
        }
      } else {
        setError(`Failed to scan for devices: ${err.message}`);
        showError('Failed to scan for devices', 'error');
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

      const started = performance.now();
      const server = await targetDevice.device.gatt.connect();

      // Look up the provisioning service and its characteristics now, so sending the details later is instant
      const service = await server.getPrimaryService(PROVISIONING_SERVICE);
      const [ssid, password, status] = await Promise.all([
        service.getCharacteristic(SSID_CHAR),
        service.getCharacteristic(PASSWORD_CHAR),
        service.getCharacteristic(STATUS_CHAR)
      ]);
      linkRef.current = { ssid, password, status };
      bluetoothMsRef.current = Math.round(performance.now() - started);
      logger.log(`Bluetooth link ready in ${bluetoothMsRef.current} ms`);

      setCurrentStep(2);
    } catch (err: any) {
      logger.error('Connection error:', err);
      setError(`Failed to connect: ${err.message}`);
      showError('Failed to connect to device', 'error');
      // Back to the start so "Find my device" is available again
      setCurrentStep(0);
    } finally {
      setConnecting(false);
    }
  };

  // Select Wi-Fi network from modal
  const selectWifiNetwork = (ssid: string) => {
    setSelectedSsid(ssid);
    setShowWifiModal(false);
  };

  // Runs once the device reports that it joined the Wi-Fi
  const finishSetup = async (ip: string | undefined, nextTimings: SetupTimings) => {
    setTimings(nextTimings);
    logger.log('Wi-Fi setup timings (ms):', nextTimings);
    setConnected(true);
    setCurrentStep(3);
    toast.success(`Tipwave device connected to Wi-Fi${ip ? ` (IP ${ip})` : ''}`);

    if (remember) {
      const saved = await wifiVault.save(selectedSsid, password);
      if (saved) setSavedNetworks(await wifiVault.list());
    }

    const notifGranted = await requestNotificationPermission();
    if (notifGranted) {
      sendNotification('✅ Setup Complete!', `Your Tipwave device is now connected to ${selectedSsid}${ip ? ` (IP: ${ip})` : ''}`, true);
    }
  };

  // Step 3: Send Wi-Fi credentials to device
  const configureWifi = async () => {
    if (!selectedDevice || !selectedSsid || !password) {
      showError('Please enter WiFi network name and password', 'error');
      return;
    }

    let cleanup = () => {};
    const deviceMessages: string[] = [];
    const attemptStarted = performance.now();
    const sinceStart = () => `${Math.round(performance.now() - attemptStarted)} ms`;
    let failureCode = '';
    try {
      setConnecting(true);
      setError('');
      setFailure(null);
      setPhase('sending');

      // Demo mode simulation - Only in development
      if (import.meta.env.DEV && (demoMode || !selectedDevice.device)) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setPhase('joining');
        await new Promise(resolve => setTimeout(resolve, 2500));
        await finishSetup('192.168.1.157', { bluetoothMs: 1500, sendMs: 800, joinMs: 2500 });
        return;
      }

      // Use the link opened in the previous step; reopen it only if Bluetooth dropped in the meantime
      let link = linkRef.current;
      if (!link || !selectedDevice.device.gatt.connected) {
        const server = await selectedDevice.device.gatt.connect();
        const service = await server.getPrimaryService(PROVISIONING_SERVICE);
        link = {
          ssid: await service.getCharacteristic(SSID_CHAR),
          password: await service.getCharacteristic(PASSWORD_CHAR),
          status: await service.getCharacteristic(STATUS_CHAR)
        };
        linkRef.current = link;
      }
      const { ssid: ssidChar, password: passwordChar, status: statusChar } = link;

      // Listen BEFORE sending anything. The device can answer the moment it has the password; a listener added
      // after the writes can miss that answer, which left the page waiting forever.
      const outcome = new Promise<{ ip?: string }>((resolve, reject) => {
        const onStatus = (event: any) => {
          let status: any;
          try {
            status = JSON.parse(new TextDecoder().decode(event.target.value));
          } catch (parseErr) {
            logger.error('Failed to parse status JSON:', parseErr);
            return;
          }
          logger.log('Status update:', status);
          deviceMessages.push(`${sinceStart()}: ${JSON.stringify(status)}`);
          if (status.state === 'success') resolve({ ip: status.ip });
          else if (status.state === 'failure') {
            failureCode = String(status.error || 'unknown');
            reject(new Error(getErrorMessage(status.error)));
          }
        };
        const onDrop = () => reject(new Error('Bluetooth connection to the device dropped. Move closer and try again.'));
        const timer = setTimeout(
          () => reject(new Error(`The device did not report back within ${JOIN_TIMEOUT_MS / 1000} seconds. Check the Wi-Fi name and password and try again.`)),
          JOIN_TIMEOUT_MS
        );
        statusChar.addEventListener('characteristicvaluechanged', onStatus);
        selectedDevice.device.addEventListener('gattserverdisconnected', onDrop);
        cleanup = () => {
          clearTimeout(timer);
          statusChar.removeEventListener('characteristicvaluechanged', onStatus);
          selectedDevice.device.removeEventListener('gattserverdisconnected', onDrop);
          statusChar.stopNotifications().catch(() => {});
        };
      });
      outcome.catch(() => {}); // the real handling is at the await below

      await statusChar.startNotifications();

      const write = (characteristic: any, text: string) => {
        const bytes = new TextEncoder().encode(text);
        return characteristic.writeValueWithResponse ? characteristic.writeValueWithResponse(bytes) : characteristic.writeValue(bytes);
      };
      const sendStarted = performance.now();
      await write(ssidChar, selectedSsid);
      await write(passwordChar, password);
      const sendMs = Math.round(performance.now() - sendStarted);

      setPhase('joining');
      const joinStarted = performance.now();
      const { ip } = await outcome;
      await finishSetup(ip, { bluetoothMs: bluetoothMsRef.current, sendMs, joinMs: Math.round(performance.now() - joinStarted) });
    } catch (err: any) {
      logger.error('Wi-Fi configuration error:', err);
      const message = err.message || 'Failed to configure Wi-Fi. Please try again.';
      const edge = (t: string) => t !== t.trim();
      const nonAscii = (t: string) => /[^\x20-\x7E]/.test(t);
      setFailure({
        code: failureCode || 'no_report',
        message,
        // Everything except the password itself, so it is safe to paste into a message
        details: JSON.stringify(
          {
            when: new Date().toISOString(),
            browser: navigator.userAgent,
            device: selectedDevice?.name,
            deviceReported: failureCode || '(nothing before the error)',
            error: message,
            deviceMessages,
            timings: { bluetoothMs: bluetoothMsRef.current, totalMs: Math.round(performance.now() - attemptStarted) },
            network: { nameLength: selectedSsid.length, nameHasEdgeSpace: edge(selectedSsid), nameNonAscii: nonAscii(selectedSsid) },
            password: { length: password.length, hasEdgeSpace: edge(password), hasNonAscii: nonAscii(password) }
          },
          null,
          2
        )
      });

      if (notificationPermission === 'granted') {
        sendNotification('❌ Setup Failed', 'Tipwave device could not connect to Wi-Fi. Please try again.', false);
      }
    } finally {
      cleanup();
      setPhase(null);
      setConnecting(false);
    }
  };

  const pickSaved = (ssid: string) => {
    const match = savedNetworks.find((n) => n.ssid === ssid);
    if (!match) return;
    setSelectedSsid(match.ssid);
    setPassword(match.password);
  };

  const forgetSaved = (ssid: string) => {
    wifiVault.forget(ssid);
    setSavedNetworks((list) => list.filter((n) => n.ssid !== ssid));
  };

  // Helper function to get user-friendly error messages
  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth_failed':
        return 'The device says the Wi-Fi password was not accepted. If you are sure it is right: make sure the network is 2.4 GHz (the device cannot join a 5 GHz-only network), that the name matches exactly, and that the device is close to the router. Tap Show to check what you typed.';
      case 'no_ssid':
        return 'WiFi network not found. Make sure the network name is correct.';
      case 'timeout':
        return 'Connection attempt timed out. Please try again.';
      case 'unknown':
      default:
        return 'Connection failed. Please try again.';
    }
  };

  const steps: { title: string; description: string; icon: BrandIconName }[] = [
    { title: 'Find', description: 'Find your Tipwave device', icon: 'qr' },
    { title: 'Connect', description: 'Connect over Bluetooth', icon: 'device' },
    { title: 'Wi-Fi', description: 'Enter your Wi-Fi details', icon: 'wifi' },
    { title: 'Done', description: 'Your device is online', icon: 'check-circle' }
  ];

  const stepState = (i: number): 'current' | 'done' | 'upcoming' =>
    i < currentStep || (i === 3 && connected) ? 'done' : i === currentStep ? 'current' : 'upcoming';

  const inputClass =
    'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-ink-900 placeholder:text-ink-400 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500';

  const resetToStart = () => {
    try { selectedDevice?.device?.gatt?.disconnect(); } catch { /* already disconnected */ }
    linkRef.current = null;
    setCurrentStep(0);
    setSelectedDevice(null);
    setWifiNetworks([]);
    setSelectedSsid('');
    setPassword('');
  };

  const startDemo = async () => {
    setScanning(true);
    setDemoMode(true);
    toast.info('Demo mode activated - simulating Tipwave device');
    await new Promise(resolve => setTimeout(resolve, 500));
    const demoDevice: BluetoothDevice = { name: 'Tipwave-TPW-DEMO-001', id: 'demo-device-001', device: null };
    setSelectedDevice(demoDevice);
    toast.success(`Selected: ${demoDevice.name} (Demo)`);
    setTimeout(() => {
      connectToDevice(demoDevice);
      setScanning(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <img src="/images/logo/tipwave-logo-v2.png" alt="Tipwave" className="mx-auto h-10 w-auto" />
          <h1 className="mt-6 text-3xl font-bold text-ink-900">Connect your device to Wi-Fi</h1>
          <p className="mt-2 text-ink-500">Your phone talks to the device over Bluetooth and gives it your Wi-Fi details.</p>
          {import.meta.env.DEV && demoMode && (
            <span className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Demo mode</span>
          )}
        </header>

        {/* Progress */}
        <Card className="mb-5">
          <ol className="grid grid-cols-4 gap-2">
            {steps.map((st, i) => {
              const state = stepState(i);
              return (
                <li key={st.title} className="flex flex-col items-center text-center">
                  <IconTile name={st.icon} state={state} size={44} />
                  <span className={`mt-2 text-sm font-semibold ${state === 'upcoming' ? 'text-ink-500' : 'text-ink-900'}`}>{st.title}</span>
                  <span className="hidden text-xs text-ink-500 sm:block">{st.description}</span>
                </li>
              );
            })}
          </ol>
        </Card>

        {environment && !environment.supportsWebBluetooth && (
          <Banner tone="warning" title="This browser can't connect to the device" className="mb-5">
            Open this page in Chrome, Edge or Opera on a computer or Android phone. iPhones and iPads can't do Bluetooth setup from a browser.
          </Banner>
        )}

        {error && (
          <Banner tone="warning" title="Before we can continue" className="mb-5" onDismiss={() => setError('')}>
            {error}
          </Banner>
        )}

        {failure && !connecting && currentStep === 2 && (
          <Banner
            tone="error"
            title="The device could not join the Wi-Fi"
            className="mb-5"
            onDismiss={() => setFailure(null)}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(failure.details);
                    toast.success('Details copied. Paste them into a message to support.');
                  } catch {
                    toast.error('Could not copy. Take a screenshot of this page instead.');
                  }
                }}
              >
                Copy details
              </Button>
            }
          >
            {failure.message}
          </Banner>
        )}

        {/* Step 0: find the device */}
        {currentStep === 0 && (
          <Card>
            <div className="py-4 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <BrandIcon name="device" size={32} />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-ink-900">Find your Tipwave device</h2>
              <p className="mx-auto mt-2 max-w-md text-ink-500">Turn the device on and keep it close to your phone or computer.</p>

              <div className="mx-auto mt-6 max-w-md rounded-2xl bg-surface p-4 text-left">
                <p className="text-sm font-semibold text-ink-700">Look for a device named</p>
                <p className="mt-1 font-mono text-ink-900">Tipwave-&lt;serial number&gt;</p>
                <p className="mt-1 text-xs text-ink-500">For example, Tipwave-TPW-5C07-3VQ</p>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                <Button size="lg" icon="search" onClick={scanForDevices} loading={scanning} disabled={!environment?.supportsWebBluetooth}>
                  {scanning ? 'Looking…' : 'Find my device'}
                </Button>
                {import.meta.env.DEV && (
                  <Button variant="secondary" onClick={startDemo} disabled={scanning}>
                    Try demo mode
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 1: connecting */}
        {currentStep === 1 && connecting && (
          <Card>
            <div className="py-8 text-center">
              <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              <h2 className="mt-5 text-2xl font-bold text-ink-900">Connecting to your device</h2>
              <p className="mt-2 text-ink-500">This takes a few seconds. Keep the device close.</p>
            </div>
          </Card>
        )}

        {/* Step 2: Wi-Fi details */}
        {currentStep === 2 && (
          <Card title="Your Wi-Fi details" subtitle="The device will use this network to send tips and play effects.">
            <div className="space-y-5">
              {savedNetworks.length > 0 && (
                <div>
                  <label htmlFor="wifi-saved" className="mb-1.5 block text-sm font-semibold text-ink-700">Saved networks</label>
                  <div className="flex gap-2">
                    <select
                      id="wifi-saved"
                      className={inputClass}
                      value={savedNetworks.some((n) => n.ssid === selectedSsid) ? selectedSsid : ''}
                      onChange={(e) => pickSaved(e.target.value)}
                      disabled={connecting}
                    >
                      <option value="">Choose a network you used before…</option>
                      {savedNetworks.map((n) => (
                        <option key={n.ssid} value={n.ssid}>{n.ssid}</option>
                      ))}
                    </select>
                    {savedNetworks.some((n) => n.ssid === selectedSsid) && (
                      <Button variant="secondary" onClick={() => forgetSaved(selectedSsid)} disabled={connecting}>
                        Forget
                      </Button>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-ink-500">Saved on this browser only. The password is stored encrypted.</p>
                </div>
              )}

              <div>
                <label htmlFor="wifi-ssid" className="mb-1.5 block text-sm font-semibold text-ink-700">Network name</label>
                <input
                  id="wifi-ssid"
                  className={inputClass}
                  placeholder="Your Wi-Fi network name"
                  value={selectedSsid}
                  onChange={(e) => setSelectedSsid(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                />
                {selectedSsid !== selectedSsid.trim() ? (
                  <p className="mt-1.5 text-sm text-amber-700">
                    The name has a space at the start or end, which phone keyboards often add. {' '}
                    <button type="button" className="font-semibold underline" onClick={() => setSelectedSsid(selectedSsid.trim())}>
                      Remove it
                    </button>
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-ink-500">Type it exactly as it appears, including capital letters.</p>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="wifi-password" className="block text-sm font-semibold text-ink-700">Password</label>
                  <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="wifi-password"
                  type={showPassword ? 'text' : 'password'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  className={inputClass}
                  placeholder="Wi-Fi password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && selectedSsid && password && configureWifi()}
                />
                {password !== password.trim() && (
                  <p className="mt-1.5 text-sm text-amber-700">
                    The password has a space at the start or end. {' '}
                    <button type="button" className="font-semibold underline" onClick={() => setPassword(password.trim())}>
                      Remove it
                    </button>
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2.5 text-sm text-ink-700">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                Remember this network on this browser
              </label>

              {connecting && phase && (
                <div role="status" className="flex items-center gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink-900">
                  <span className="h-5 w-5 flex-none animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  <span>
                    {phase === 'sending' ? 'Sending the Wi-Fi details to your device…' : 'Your device is joining the Wi-Fi…'}{' '}
                    <span className="text-ink-500">{elapsed} s</span>
                  </span>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <Button variant="secondary" size="lg" onClick={resetToStart} disabled={connecting}>
                  Start over
                </Button>
                <Button size="lg" icon="wifi" onClick={configureWifi} loading={connecting} disabled={!selectedSsid || !password}>
                  {connecting ? 'Connecting…' : 'Connect to Wi-Fi'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: done */}
        {currentStep === 3 && connected && (
          <Card>
            <div className="py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <BrandIcon name="check-circle" size={34} color="#15803D" />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-ink-900">Your device is online</h2>
              <p className="mt-2 text-ink-500">
                Connected to <strong className="text-ink-900">{selectedSsid}</strong>. You are ready to take tips.
              </p>
              {(timings.bluetoothMs != null || timings.sendMs != null || timings.joinMs != null) && (
                <dl className="mx-auto mt-5 max-w-xs space-y-1 rounded-2xl bg-surface p-4 text-left text-sm">
                  <dt className="font-semibold text-ink-700">Where the time went</dt>
                  {timings.bluetoothMs != null && (
                    <dd className="flex justify-between text-ink-500"><span>Bluetooth link to the device</span><span>{seconds(timings.bluetoothMs)}</span></dd>
                  )}
                  {timings.sendMs != null && (
                    <dd className="flex justify-between text-ink-500"><span>Sending the Wi-Fi details</span><span>{seconds(timings.sendMs)}</span></dd>
                  )}
                  {timings.joinMs != null && (
                    <dd className="flex justify-between text-ink-500"><span>Device joining the Wi-Fi</span><span>{seconds(timings.joinMs)}</span></dd>
                  )}
                </dl>
              )}
              <div className="mt-6">
                <Button size="lg" onClick={() => (window.location.href = '/dashboard')}>
                  Go to my portal
                </Button>
              </div>
            </div>
          </Card>
        )}

        <p className="mt-8 text-center text-sm text-ink-500">
          Bluetooth setup works in Chrome, Edge or Opera on a computer or an Android phone.
        </p>
      </div>

      {/* Wi-Fi networks the device can see */}
      <Modal open={showWifiModal} onClose={() => setShowWifiModal(false)} title="Choose a Wi-Fi network">
        <ul className="divide-y divide-slate-100">
          {wifiNetworks.map(network => (
            <li key={network.ssid}>
              <button
                onClick={() => selectWifiNetwork(network.ssid)}
                className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"
              >
                <BrandIcon name="wifi" size={22} />
                <span className="flex-1 font-semibold text-ink-900">{network.ssid}</span>
                <span className="text-sm text-ink-500">{network.rssi} dBm</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};

export default DeviceWifiSetup;
