import logger from "../utils/logger";
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Table, Button, Input, InputNumber, message, Spin, Card, Select, DatePicker, Space, Divider, Alert, Tabs } from 'antd';
import { 
  ReloadOutlined,
  PlayCircleOutlined,
  SyncOutlined,
  DownloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { apiService } from '../services/api';
import { isRefundEligible } from '../utils/refunds';
import AggregatedChargesTable from '../components/AggregatedChargesTable';
import RecoverChargedTips from '../components/RecoverChargedTips';
import ClearFailedTestTips from '../components/ClearFailedTestTips';
import MarkDemoTips from '../components/MarkDemoTips';
import PerformerInsights from '../components/PerformerInsights';
import dayjs from 'dayjs';
import { PortalShell, type PortalNavItem } from '../components/portal/PortalShell';
import { Banner, Button as UiButton, Card as UiCard, Modal, PageHeader, PageLoader, StatCard, StatusChip, useFeedback, type ChipKind } from '../components/ui';
import { BrandIcon } from '../components/icons/BrandIcons';

const { Search } = Input;
const { RangePicker } = DatePicker;

interface PaymentSecurityLimits {
  maxChargesPerHourPerUser: number;
  maxChargesPerDayPerUser: number;
  maxChargesPerHourPerPaymentMethod: number;
}

interface AdminDashboardStats {
  totalUsers: number;
  totalDevices: number;
  totalTips: number;
  totalRevenue: number;
  totalPlatformFees: number;
  totalPaymentPartnerFees: number;
  netPlatformEarnings: number;
  totalPerformerPayouts: number;
  activePerformers: number;
  pendingTips: number;
}

interface PerformerSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stageName?: string;
  role: string;
  platformFeePercentage: number;
  totalTips: number;
  totalEarnings: number;
  totalPlatformFees: number;
  isActive: boolean;
  createdAt: string;
}

interface PlatformEarningsSummary {
  totalPlatformFees: number;
  totalPaymentPartnerFees: number;
  netPlatformEarnings: number;
  paymentPartnerPercentage: number;
  monthlyBreakdown: Record<string, number>;
}


interface BatchStatus {
  id?: string;
  startedAt?: string;
  completedAt?: string;
  status: string;
  tipsProcessed: number;
  tipsFailed: number;
  tipsPending: number;
  totalAmount: number;
  errorMessage?: string;
  failureDetails?: string[];
  durationSeconds?: number;
  isManual: boolean;
}

interface TipDetail {
  id: string;
  createdAt: string;
  processedAt?: string;
  refundedAt?: string;
  amount: number;
  deviceNickname: string;
  performerFirstName: string;
  performerLastName: string;
  performerEmail: string;
  status: string;
  stripePaymentIntentId?: string;
  stripeRefundId?: string;
  effect: string;
  duration: number;
  platformFee: number;
  performerEarnings: number;
  failureReason?: string | null;
}

interface PerformerDeviceSummary {
  id: string;
  serialNumber?: string;
  nickname?: string;
  isDeleted: boolean;
  createdAt: string;
}

interface PerformerWithDevicesSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stageName?: string;
  isActive: boolean;
  devices: PerformerDeviceSummary[];
}

interface SimulationDevice {
  serialNumber: string;
  deviceUuid: string;
  performerName: string;
}

interface SimulationTipper {
  temporaryId: string;
  paymentMethodId: string;
  stripeCustomerId: string;
  isPayWallet: boolean;
}

interface SimulationTipperSelection {
  paywalletTippers: SimulationTipper[];
  manualTippers: SimulationTipper[];
}

// Plain-language versions of the technical reasons a charge can fail
const friendlyReason = (raw?: string | null): string | null => {
  if (!raw) return null;
  if (/No balance transaction found/i.test(raw)) return 'Stripe did not return the fee details. The card may have been charged.';
  if (/Missing Stripe customer or payment method/i.test(raw)) return 'No saved card for this tip.';
  if (/does not belong to the Customer|PaymentMethod mismatch/i.test(raw)) return 'The saved card does not match the customer.';
  if (/declin/i.test(raw)) return 'The card was declined.';
  if (/rate.?limit|too many/i.test(raw)) return 'Blocked by the payment security limits.';
  return raw;
};

const friendlyBatchNote = (raw?: string | null): string | null => {
  if (!raw) return null;
  const marker = 'Charge failures: ';
  const i = raw.indexOf(marker);
  if (i < 0) return friendlyReason(raw);
  return raw
    .slice(i + marker.length)
    .split(' | ')
    .map(r => friendlyReason(r))
    .filter(Boolean)
    .join(' · ');
};

const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

// Status chips: an icon plus a word, in the Tipwave status colors
const tipStatusChip = (status: string) => {
  const map: Record<string, { kind: ChipKind; label: string }> = {
    processed: { kind: 'paid', label: 'Charged' },
    pending: { kind: 'processing', label: 'Waiting' },
    failed: { kind: 'failed', label: 'Failed' },
    error: { kind: 'failed', label: 'Error' },
    refunded: { kind: 'info', label: 'Refunded' }
  };
  const c = map[status] || { kind: 'offline' as ChipKind, label: status };
  return <StatusChip kind={c.kind} label={c.label} />;
};

const runStatusChip = (status?: string) => {
  const map: Record<string, { kind: ChipKind; label: string }> = {
    success: { kind: 'paid', label: 'Success' },
    failed: { kind: 'failed', label: 'Failed' },
    running: { kind: 'processing', label: 'Running' }
  };
  const c = (status && map[status]) || { kind: 'offline' as ChipKind, label: status || 'Unknown' };
  return <StatusChip kind={c.kind} label={c.label} />;
};

const AdminDashboard: React.FC = () => {
  const { confirm, toast: showError } = useFeedback();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [performers, setPerformers] = useState<PerformerSummary[]>([]);
  const [platformEarnings, setPlatformEarnings] = useState<PlatformEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Stripe mode state
  const [stripeMode, setStripeMode] = useState<'test' | 'live'>('test');
  const [isProductionEnv, setIsProductionEnv] = useState(false);
  const [canToggleStripe, setCanToggleStripe] = useState(false);
  const [stripeModeLoading, setStripeModeLoading] = useState(false);
  const [stripeModeConfirming, setStripeModeConfirming] = useState(false);
  const [liveConfirmText, setLiveConfirmText] = useState('');
  const [stripeModeError, setStripeModeError] = useState<string | null>(null);
  const [stripeModeNotice, setStripeModeNotice] = useState<{ type: 'success' | 'warning' | 'error' | 'info'; text: string } | null>(null);

  // Payment security rate limits (stored per environment)
  const [rateLimits, setRateLimits] = useState<PaymentSecurityLimits>({ maxChargesPerHourPerUser: 0, maxChargesPerDayPerUser: 0, maxChargesPerHourPerPaymentMethod: 0 });
  const [rateLimitDefaults, setRateLimitDefaults] = useState<PaymentSecurityLimits | null>(null);
  const [rateLimitsLoading, setRateLimitsLoading] = useState(false);
  const [rateLimitsSaving, setRateLimitsSaving] = useState(false);

  const [updateFeeModal, setUpdateFeeModal] = useState(false);
  const [selectedPerformer, setSelectedPerformer] = useState<PerformerSummary | null>(null);
  const [newFeePercentage, setNewFeePercentage] = useState<number>(10);
  const [updatingFee, setUpdatingFee] = useState(false);

  // Batch processing state
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [batchHistory, setBatchHistory] = useState<BatchStatus[]>([]);
  const [batchHistoryModal, setBatchHistoryModal] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResultMessage, setBatchResultMessage] = useState<{ type: 'success' | 'warning' | 'error', text: string } | null>(null);

  // Tips management state
  const [tips, setTips] = useState<TipDetail[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [totalTips, setTotalTips] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [maxAmount, setMaxAmount] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('overview');
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTip, setRefundTip] = useState<TipDetail | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);

  // Performer devices management state
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('');
  const [deviceSearchLoading, setDeviceSearchLoading] = useState(false);
  const [deviceSearchResults, setDeviceSearchResults] = useState<PerformerWithDevicesSummary[]>([]);
  const [availableSerials, setAvailableSerials] = useState<string[]>([]);
  const [serialSearchLoading, setSerialSearchLoading] = useState(false);
  const [selectedSerials, setSelectedSerials] = useState<Record<string, string | undefined>>({});
  const [pendingDeviceAction, setPendingDeviceAction] = useState<{
    type: 'add' | 'delete';
    performer: PerformerWithDevicesSummary;
    deviceId?: string;
    serialNumber: string;
  } | null>(null);
  const [deviceActionLoading, setDeviceActionLoading] = useState(false);
  const [notifyPerformer, setNotifyPerformer] = useState(false);

  // Device tip simulation state
  const [simulationDevices, setSimulationDevices] = useState<SimulationDevice[]>([]);
  const [selectedSimulationDevice, setSelectedSimulationDevice] = useState<SimulationDevice | null>(null);
  const [simulationFrequency, setSimulationFrequency] = useState<number>(4000);
  const [simulationPaymentMode, setSimulationPaymentMode] = useState<'paywallet' | 'manual' | 'auto'>('manual');
  const [simulationAmountMode, setSimulationAmountMode] = useState<'auto' | number>('auto');
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationElapsed, setSimulationElapsed] = useState(0);
  const [simulationTipCount, setSimulationTipCount] = useState(0);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const simulationStartRef = useRef<number | null>(null);
  const simulationInFlightRef = useRef(false);
  const simulationTippersRef = useRef<SimulationTipperSelection | null>(null);
  const simulationTipperIndexRef = useRef(0);

  useEffect(() => {
    // Verify admin access via profile to avoid JWT decode issues
    const verifyAdmin = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return false;
      }
      const profile = await apiService.getProfile();
      if (profile?.data?.role === 'root_admin') {
        return true;
      }
      showError('Access denied. Admin privileges required.', 'error');
      navigate('/dashboard');
      return false;
    };

    // Run verification, then load data
    verifyAdmin().then((isAdmin) => {
      if (!isAdmin) return;
      loadDashboardData();
      fetchUserProfile();
      loadBatchStatus();
      loadTips();
      loadStripeMode();
      loadRateLimits();

      // Auto-refresh batch status every 3 minutes
      const batchRefreshInterval = setInterval(() => {
        loadBatchStatus();
      }, 180000);

      return () => clearInterval(batchRefreshInterval);
    });
  }, [navigate]);

  // Reload tips when filters change
  useEffect(() => {
    loadTips();
  }, [currentPage, filterStatus, dateRange, searchTerm, minAmount, maxAmount]);

  const fetchUserProfile = async () => {
    try {
      const response = await apiService.getProfile();
      if (response.data) {
        setUserProfile(response.data);
      }
    } catch (error) {
      logger.error('Error fetching user profile:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const [statsResponse, performersResponse, earningsResponse] = await Promise.all([
        apiService.get(`/api/admin/dashboard-stats?_t=${timestamp}`),
        apiService.get(`/api/admin/performers?_t=${timestamp}`),
        apiService.get(`/api/admin/platform-earnings?_t=${timestamp}`)
      ]);

      if (statsResponse.data) setStats(statsResponse.data);
      if (performersResponse.data) setPerformers(performersResponse.data);
      if (earningsResponse.data) setPlatformEarnings(earningsResponse.data);
    } catch (error) {
      logger.error('Error loading admin dashboard data:', error);
      showError('Failed to load admin dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    try {
      if (value.trim()) {
        const searchResults = await apiService.get(`/api/admin/performers/search?q=${encodeURIComponent(value)}`);
        if (searchResults.data) setPerformers(searchResults.data);
      } else {
        const allPerformers = await apiService.get('/api/admin/performers');
        if (allPerformers.data) setPerformers(allPerformers.data);
      }
    } catch (error) {
      logger.error('Error searching performers:', error);
      showError('Failed to search performers', 'error');
    }
  };

  const handleUpdateFee = async () => {
    if (!selectedPerformer) return;

    try {
      setUpdatingFee(true);
      logger.log('🔧 [DEBUG] Updating platform fee for performer:', selectedPerformer.id);
      logger.log('🔧 [DEBUG] New fee percentage:', newFeePercentage);
      
      const response = await apiService.put(`/api/admin/performers/${selectedPerformer.id}/platform-fee`, {
        platformFeePercentage: newFeePercentage
      });
      
      logger.log('🔧 [DEBUG] Update response:', response);

      message.success(`Platform fee updated to ${newFeePercentage}%`);
      setUpdateFeeModal(false);
      setSelectedPerformer(null);
      setNewFeePercentage(10);
      
      // Reload data to reflect changes
      logger.log('🔧 [DEBUG] Reloading dashboard data...');
      await loadDashboardData();
      logger.log('🔧 [DEBUG] Dashboard data reloaded');
    } catch (error) {
      logger.error('Error updating platform fee:', error);
      showError('Failed to update platform fee', 'error');
    } finally {
      setUpdatingFee(false);
    }
  };

  const loadStripeMode = async () => {
    try {
      const response = await apiService.get('/api/stripe-config/mode');
      if (response.data) {
        setStripeMode(response.data.mode);
        setIsProductionEnv(response.data.isProductionEnvironment);
        setCanToggleStripe(response.data.canToggle);
      }
    } catch (error) {
      logger.error('Error loading Stripe mode:', error);
    }
  };

  const applyRateLimitResponse = (data: { current: PaymentSecurityLimits; defaults: PaymentSecurityLimits }) => {
    setRateLimits(data.current);
    setRateLimitDefaults(data.defaults);
  };

  const loadRateLimits = async () => {
    try {
      setRateLimitsLoading(true);
      const response = await apiService.get('/api/payment-security-config/rate-limits');
      if (response.data) {
        applyRateLimitResponse(response.data);
      } else if (response.error) {
        showError(`Failed to load payment security limits: ${response.error}`, 'error');
      }
    } catch (error) {
      logger.error('Error loading payment security limits:', error);
    } finally {
      setRateLimitsLoading(false);
    }
  };

  const saveRateLimits = async () => {
    try {
      setRateLimitsSaving(true);
      const response = await apiService.put('/api/payment-security-config/rate-limits', rateLimits);
      if (response.error) {
        showError(response.error, 'error');
      } else if (response.data) {
        applyRateLimitResponse(response.data);
        message.success('Payment security limits saved');
      }
    } catch (error) {
      logger.error('Error saving payment security limits:', error);
      showError('Failed to save payment security limits', 'error');
    } finally {
      setRateLimitsSaving(false);
    }
  };

  const resetRateLimits = async () => {
    try {
      setRateLimitsSaving(true);
      const response = await apiService.delete('/api/payment-security-config/rate-limits');
      if (response.error) {
        showError(response.error, 'error');
      } else if (response.data) {
        applyRateLimitResponse(response.data);
        message.success('Payment security limits reset to defaults');
      }
    } catch (error) {
      logger.error('Error resetting payment security limits:', error);
      showError('Failed to reset payment security limits', 'error');
    } finally {
      setRateLimitsSaving(false);
    }
  };

  const handleToggleStripeMode = () => {
    setLiveConfirmText('');
    setStripeModeError(null);
    setStripeModeNotice(null);
    setStripeModeConfirming(true);
  };

  const confirmToggleStripeMode = async () => {
    try {
      setStripeModeLoading(true);
      setStripeModeError(null);
      const newMode = stripeMode === 'test' ? 'live' : 'test';
      
      const response = await apiService.post('/api/stripe-config/mode', { mode: newMode });
      
      if (response.error) {
        setStripeModeError(response.error);
        return;
      }

      if (response.data) {
        setStripeModeError(null);
        setStripeMode(newMode);
        setStripeModeNotice({
          type: newMode === 'live' ? 'error' : 'success',
          text: `Stripe mode switched to ${newMode.toUpperCase()}`
        });
        setStripeModeConfirming(false);
      }
    } catch (error: any) {
      logger.error('Error toggling Stripe mode:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to toggle Stripe mode';
      setStripeModeError(errorMsg);
    } finally {
      setStripeModeLoading(false);
    }
  };



  const runBatchProcessing = async () => {
    setBatchProcessing(true);
    setBatchResultMessage(null);
    try {
      const result = await apiService.post('/api/admin/batch-process');
      const tipsProcessed = Number(result.data?.tipsProcessed ?? 0);
      const success = Boolean(result.data?.success);
      const responseMsg = result.data?.message || 'Batch processing completed';

      // Determine message type based on response success flag and tips processed
      if (success === true && tipsProcessed > 0) {
        setBatchResultMessage({ type: 'success', text: responseMsg });
      } else if (success === false && tipsProcessed === 0) {
        // Warning: no tips processed (likely not pending yet)
        setBatchResultMessage({ type: 'warning', text: responseMsg });
      } else if (success === false) {
        // Error: failure occurred
        setBatchResultMessage({ type: 'error', text: responseMsg || 'Failed to run batch processing' });
      } else {
        // Fallback for unexpected state
        setBatchResultMessage({ type: 'warning', text: responseMsg || 'Batch processing completed with unexpected result' });
      }
      // Wait a moment for DB to commit, then reload stats
      setTimeout(() => {
        loadDashboardData();
        loadBatchStatus();
        loadTips();
        loadBatchHistory();
      }, 1000);
    } catch (error: any) {
      logger.error('Error running batch processing:', error);
      const errorMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to run batch processing';
      setBatchResultMessage({ type: 'error', text: errorMsg });
    } finally {
      setBatchProcessing(false);
    }
  };

  const loadBatchStatus = async () => {
    try {
      const response = await apiService.get('/api/admin/batch-status');
      if (response.data) {
        setBatchStatus(response.data);
      }
    } catch (error) {
      logger.error('Error loading batch status:', error);
    }
  };

  const loadBatchHistory = async () => {
    try {
      const response = await apiService.get('/api/admin/batch-history?limit=50');
      if (response.data?.history) {
        setBatchHistory(response.data.history);
        setBatchHistoryModal(true);
      }
    } catch (error) {
      logger.error('Error loading batch history:', error);
      showError('Failed to load batch history', 'error');
    }
  };

  const loadTips = async () => {
    try {
      setTipsLoading(true);
      const response = await apiService.post('/api/admin/tips/search', {
        page: currentPage,
        pageSize: pageSize,
        status: filterStatus,
        startDate: dateRange?.[0]?.toISOString(),
        endDate: dateRange?.[1]?.toISOString(),
        searchTerm: searchTerm,
        minAmount: minAmount,
        maxAmount: maxAmount
      });

      if (response.data) {
        setTips(response.data.tips);
        setTotalTips(response.data.totalCount);
      }
    } catch (error) {
      logger.error('Error loading tips:', error);
      showError('Failed to load tips', 'error');
    } finally {
      setTipsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        window.clearInterval(simulationIntervalRef.current);
      }
      if (simulationTimerRef.current) {
        window.clearInterval(simulationTimerRef.current);
      }
    };
  }, []);

  const loadPerformerDevices = async (search: string) => {
    try {
      setDeviceSearchLoading(true);
      const response = await apiService.get(`/api/admin/performers/search-devices?q=${encodeURIComponent(search)}`);
      if (response.data) {
        setDeviceSearchResults(response.data);
      }
    } catch (error) {
      logger.error('Error searching performers/devices:', error);
      showError('Failed to search performers/devices', 'error');
    } finally {
      setDeviceSearchLoading(false);
    }
  };

  const loadAvailableSerials = async (search: string) => {
    try {
      if (!search?.trim()) {
        setAvailableSerials([]);
        return;
      }
      setSerialSearchLoading(true);
      const response = await apiService.get(`/api/admin/devices/available?query=${encodeURIComponent(search)}`);
      if (Array.isArray(response.data)) {
        setAvailableSerials(response.data.map((item: { serialNumber: string }) => item.serialNumber));
      }
    } catch (error) {
      logger.error('Error searching available devices:', error);
    } finally {
      setSerialSearchLoading(false);
    }
  };

  const openAddDeviceModal = (performer: PerformerWithDevicesSummary, serialNumber: string) => {
    setPendingDeviceAction({ type: 'add', performer, serialNumber });
    setNotifyPerformer(false);
  };

  const openDeleteDeviceModal = (performer: PerformerWithDevicesSummary, deviceId: string, serialNumber: string) => {
    setPendingDeviceAction({ type: 'delete', performer, deviceId, serialNumber });
    setNotifyPerformer(false);
  };

  const runDeviceAction = async (sendEmail: boolean) => {
    if (!pendingDeviceAction) return;

    try {
      setDeviceActionLoading(true);
      if (pendingDeviceAction.type === 'add') {
        await apiService.post(`/api/admin/performers/${pendingDeviceAction.performer.id}/devices/add`, {
          serialNumber: pendingDeviceAction.serialNumber,
          sendEmail
        });
        message.success('Device added successfully');
        setSelectedSerials((prev) => ({
          ...prev,
          [pendingDeviceAction.performer.id]: undefined
        }));
      } else {
        await apiService.post(`/api/admin/performers/${pendingDeviceAction.performer.id}/devices/${pendingDeviceAction.deviceId}/delete`, {
          sendEmail
        });
        message.success('Device deleted successfully');
      }

      // Keep user on the same tab and preserve search context
      setActiveTab('device-management');
      if (deviceSearchTerm.trim()) {
        await loadPerformerDevices(deviceSearchTerm.trim());
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Device action failed';
      logger.error('Error performing device action:', error);
      showError(errorMsg, 'error');
    } finally {
      setDeviceActionLoading(false);
      setPendingDeviceAction(null);
    }
  };

  const isSimulationVisible = userProfile?.role === 'root_admin' &&
    /(^localhost$|^127\.0\.0\.1$|apptest)/i.test(window.location.hostname);

  const loadSimulationDevices = async (query: string) => {
    try {
      setSimulationLoading(true);
      const response = await apiService.get(`/api/admin/device-tip-simulation/devices?q=${encodeURIComponent(query)}`);
      if (Array.isArray(response.data)) {
        setSimulationDevices(response.data);
      } else {
        setSimulationDevices([]);
      }
    } catch (error) {
      logger.error('Error loading simulation devices:', error);
      setSimulationError('Failed to load devices.');
    } finally {
      setSimulationLoading(false);
    }
  };

  const getSimulationEffect = (amount: number) => {
    if (amount >= 100) return 'rainbow';
    if (amount >= 50) return 'gold';
    if (amount >= 20) return 'purple';
    if (amount >= 10) return 'blue';
    return 'green';
  };

  const pickSimulationAmount = () => {
    if (simulationAmountMode !== 'auto') {
      return simulationAmountMode;
    }
    const options = [2, 5, 10, 20, 50, 100];
    return options[Math.floor(Math.random() * options.length)];
  };

  const pickSimulationTipper = () => {
    const tippers = simulationTippersRef.current;
    if (!tippers) return null;

    const paywalletPool = tippers.paywalletTippers ?? [];
    const manualPool = tippers.manualTippers ?? [];

    if (simulationPaymentMode === 'paywallet') {
      if (!paywalletPool.length) return null;
      const idx = simulationTipperIndexRef.current % paywalletPool.length;
      simulationTipperIndexRef.current += 1;
      return paywalletPool[idx];
    }
    if (simulationPaymentMode === 'manual') {
      if (!manualPool.length) return null;
      const idx = simulationTipperIndexRef.current % manualPool.length;
      simulationTipperIndexRef.current += 1;
      return manualPool[idx];
    }

    if (!paywalletPool.length || !manualPool.length) return null;
    const pool = simulationTipperIndexRef.current % 2 === 0 ? paywalletPool : manualPool;
    const idx = simulationTipperIndexRef.current % pool.length;
    simulationTipperIndexRef.current += 1;
    return pool[idx];
  };

  const startSimulation = async () => {
    if (!selectedSimulationDevice) {
      setSimulationError('Select a device to simulate.');
      return;
    }

    if (simulationRunning) {
      return;
    }

    setSimulationError(null);

    if (!simulationTippersRef.current) {
      try {
        setSimulationLoading(true);
        const response = await apiService.post('/api/admin/device-tip-simulation/select-tippers', {
          mode: simulationPaymentMode,
          maxPerMode: 20
        });
        simulationTippersRef.current = response.data || null;
        simulationTipperIndexRef.current = 0;
      } catch (error) {
        logger.error('Error selecting simulation tippers:', error);
        setSimulationError('Failed to select tippers.');
        setSimulationLoading(false);
        return;
      } finally {
        setSimulationLoading(false);
      }
    }

    if (simulationPaymentMode === 'paywallet' && !(simulationTippersRef.current?.paywalletTippers?.length)) {
      setSimulationError('No eligible PayWallet tippers found.');
      return;
    }
    if (simulationPaymentMode === 'manual' && !(simulationTippersRef.current?.manualTippers?.length)) {
      setSimulationError('No eligible manual tippers found.');
      return;
    }
    if (simulationPaymentMode === 'auto' &&
        (!(simulationTippersRef.current?.paywalletTippers?.length) || !(simulationTippersRef.current?.manualTippers?.length))) {
      setSimulationError('Both PayWallet and manual tippers are required for auto mode.');
      return;
    }

    const startBase = Date.now() - (simulationElapsed * 1000);
    simulationStartRef.current = startBase;

    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
    }
    simulationTimerRef.current = window.setInterval(() => {
      if (simulationStartRef.current) {
        setSimulationElapsed(Math.floor((Date.now() - simulationStartRef.current) / 1000));
      }
    }, 500);

    if (simulationIntervalRef.current) {
      window.clearInterval(simulationIntervalRef.current);
    }

    simulationIntervalRef.current = window.setInterval(async () => {
      if (simulationInFlightRef.current) {
        return;
      }
      const tipper = pickSimulationTipper();
      if (!tipper) {
        setSimulationError('Simulation stopped: no eligible tipper found.');
        stopSimulation();
        return;
      }

      const amount = pickSimulationAmount();
      const effect = getSimulationEffect(amount);

      try {
        simulationInFlightRef.current = true;
        await apiService.submitTip({
          deviceId: selectedSimulationDevice.deviceUuid,
          userId: tipper.temporaryId,
          amount,
          effect,
          duration: 3000,
          paymentMethodId: tipper.paymentMethodId,
          stripeCustomerId: tipper.stripeCustomerId,
          simulationBypassSecurity: true
        });
        setSimulationTipCount((prev) => prev + 1);
      } catch (error) {
        logger.error('Simulation tip failed:', error);
        setSimulationError('Simulation stopped: tip submission failed.');
        stopSimulation();
      } finally {
        simulationInFlightRef.current = false;
      }
    }, simulationFrequency);

    setSimulationRunning(true);
  };

  const stopSimulation = () => {
    if (simulationIntervalRef.current) {
      window.clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setSimulationRunning(false);
  };

  const cancelSimulation = () => {
    stopSimulation();
    simulationTippersRef.current = null;
    simulationTipperIndexRef.current = 0;
    simulationStartRef.current = null;
    setSimulationElapsed(0);
    setSimulationTipCount(0);
    setSimulationError(null);
  };

  const formatSimulationTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openRefundModal = (tip: TipDetail) => {
    setRefundTip(tip);
    setRefundModalOpen(true);
  };

  const handleRefundConfirm = async () => {
    if (!refundTip) return;
    try {
      setRefundLoading(true);
      await apiService.post(`/api/admin/tips/${refundTip.id}/refund`);
      message.success('Refund processed successfully');
      setRefundModalOpen(false);
      setRefundTip(null);
      await loadTips();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to process refund';
      logger.error('Error processing refund:', error);
      showError(errorMsg, 'error');
    } finally {
      setRefundLoading(false);
    }
  };

  const exportTips = async () => {
    try {
      let url = '/api/admin/tips/export-csv';
      const params = new URLSearchParams();
      
      if (filterStatus) params.append('status', filterStatus);
      if (dateRange?.[0]) params.append('startDate', dateRange[0].toISOString());
      if (dateRange?.[1]) params.append('endDate', dateRange[1].toISOString());
      
      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await apiService.get(url);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `tips_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      message.success('Tips exported successfully');
    } catch (error) {
      logger.error('Error exporting tips:', error);
      showError('Failed to export tips', 'error');
    }
  };


  const getBatchStatusIcon = () => {
    if (!batchStatus) return null;
    if (batchStatus.status === 'success') return <BrandIcon name="check-circle" size={20} color="#15803D" />;
    if (batchStatus.status === 'failed') return <BrandIcon name="error" size={20} color="#DC2626" />;
    if (batchStatus.status === 'running') return <SyncOutlined spin />;
    return null;
  };

  const performerColumns = [
    {
      title: 'Name',
      key: 'name',
      render: (record: PerformerSummary) => (
        <div>
          <div className="font-medium">
            {record.firstName} {record.lastName}
          </div>
          {record.stageName && (
            <div className="text-sm text-ink-500">@{record.stageName}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Platform Fee',
      key: 'platformFee',
      render: (record: PerformerSummary) => (
        <div className="text-center">
          <div className="font-medium text-brand-700">{record.platformFeePercentage}%</div>
          <Button 
            type="link" 
            size="small"
            onClick={() => {
              setSelectedPerformer(record);
              setNewFeePercentage(record.platformFeePercentage);
              setUpdateFeeModal(true);
            }}
          >
            Update
          </Button>
        </div>
      ),
    },
    {
      title: 'Tips',
      dataIndex: 'totalTips',
      key: 'totalTips',
      render: (value: number) => (
        <div className="text-center font-medium">{value}</div>
      ),
    },
    {
      title: 'Earnings',
      key: 'earnings',
      render: (record: PerformerSummary) => (
        <div className="text-right">
          <div className="font-medium text-green-600">
            ${record.totalEarnings.toFixed(2)}
          </div>
          <div className="text-sm text-ink-500">
            Platform: ${record.totalPlatformFees.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: PerformerSummary) => (
        <StatusChip kind={record.isActive ? 'active' : 'offline'} label={record.isActive ? 'Active' : 'Inactive'} />
      ),
    },
  ];

  if (loading) {
    return (
      <PageLoader label="Loading admin…" />
    );
  }

  const adminNav: PortalNavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'performers', label: 'Performers', icon: 'users' },
    { id: 'tips', label: 'Tips', icon: 'coin' },
    { id: 'aggregated-charges', label: 'Charges', icon: 'card' },
    ...(userProfile?.role === 'root_admin' ? [{ id: 'device-management', label: 'Devices', icon: 'device' } as PortalNavItem] : []),
    { id: 'performer-insights', label: 'Insights', icon: 'trend-up' },
    ...(isSimulationVisible ? [{ id: 'device-tip-simulation', label: 'Tools', icon: 'bolt' } as PortalNavItem] : []),
    { id: 'settings', label: 'Settings', icon: 'sliders' },
    { id: 'performer-view', label: 'Performer view', icon: 'mic' }
  ];

  const ADMIN_TITLES: Record<string, { title: string; subtitle?: string }> = {
    overview: { title: 'Overview', subtitle: 'How the platform is doing right now.' },
    performers: { title: 'Performers', subtitle: 'Everyone who can receive tips, and their fee.' },
    tips: { title: 'Tips', subtitle: 'Search, export and refund tips.' },
    'aggregated-charges': { title: 'Charges', subtitle: 'What was charged to each card, combined per batch.' },
    'device-management': { title: 'Devices', subtitle: 'Add or remove devices on a performer’s behalf.' },
    'performer-insights': { title: 'Insights', subtitle: 'Tips by time of day and performer.' },
    'device-tip-simulation': { title: 'Tools', subtitle: 'Send test tips to a device. Only on local and test sites.' },
    settings: { title: 'Settings', subtitle: 'Stripe mode and payment security limits.' }
  };

  // Always visible in the corner of every page, so nobody mistakes the mode they are working in
  const modeNotice =
    stripeMode === 'live' ? (
      <Banner tone="error" title="Live mode: real money">
        Tips are charged to real cards.
      </Banner>
    ) : (
      <Banner tone="info" title="Stripe test mode">
        No real charges are made.
      </Banner>
    );

  return (
    <PortalShell
      items={adminNav}
      active={activeTab}
      onSelect={id => (id === 'performer-view' ? navigate('/dashboard') : setActiveTab(id))}
      userName={userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim() : 'Admin'}
      userPhotoUrl={userProfile?.profilePhotoUrl || undefined}
      accountHint="Back to my portal"
      onOpenProfile={() => navigate('/dashboard')}
      onLogout={() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        navigate('/login');
      }}
      topNotice={modeNotice}
    >
      <PageHeader title={ADMIN_TITLES[activeTab]?.title || 'Admin'} subtitle={ADMIN_TITLES[activeTab]?.subtitle} />
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard variant="inline" icon="users" label="Audience" value={(stats?.totalUsers || 0).toLocaleString()} caption="People who have tipped" />
              <StatCard variant="inline" icon="device" label="Devices" value={(stats?.totalDevices || 0).toLocaleString()} caption="Not deleted" />
              <StatCard variant="inline" icon="coin" label="Tips" value={(stats?.totalTips || 0).toLocaleString()} caption={`${(stats?.pendingTips || 0).toLocaleString()} waiting to be charged`} />
              <StatCard variant="inline" icon="mic" label="Performers" value={(stats?.activePerformers || 0).toLocaleString()} caption="With at least one device" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <UiCard title="Revenue" subtitle="Tips that were charged successfully">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Revenue</dt>
                    <dd className="font-bold text-ink-900">${(stats?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Owed to performers</dt>
                    <dd className="font-bold text-ink-900">${(stats?.totalPerformerPayouts || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  </div>
                </dl>
              </UiCard>
              <UiCard title="Platform earnings" subtitle="Estimated from the fee settings">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Platform fees</dt>
                    <dd className="font-bold text-ink-900">${(platformEarnings?.totalPlatformFees || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Stripe fees (estimated)</dt>
                    <dd className="font-bold text-ink-900">${(platformEarnings?.totalPaymentPartnerFees || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
                    <dt className="font-semibold text-ink-700">Net earnings</dt>
                    <dd className="font-bold text-ink-900">${(platformEarnings?.netPlatformEarnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  </div>
                </dl>
              </UiCard>
              <UiCard title="Charge tips" subtitle={`${stats?.pendingTips || 0} tips are waiting to be charged.`}>
                {batchResultMessage && (
                  <Alert
                    className="mb-3"
                    type={batchResultMessage.type}
                    message={batchResultMessage.text}
                    showIcon
                    closable
                    onClose={() => setBatchResultMessage(null)}
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    type="primary"
                    icon={batchProcessing ? <ReloadOutlined spin /> : <PlayCircleOutlined />}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Run batch processing now?',
                        body: `This charges ${stats?.pendingTips || 0} waiting tip(s) in ${stripeMode === 'live' ? 'LIVE mode with real money' : 'test mode'}. It cannot be undone.`,
                        confirmLabel: 'Run batch',
                        tone: stripeMode === 'live' ? 'danger' : 'default'
                      });
                      if (ok) runBatchProcessing();
                    }}
                    loading={batchProcessing}
                    disabled={batchProcessing}
                    className="flex-1"
                  >
                    {batchProcessing ? 'Running…' : 'Run batch now'}
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      setBatchResultMessage(null);
                      loadDashboardData();
                    }}
                    aria-label="Refresh data"
                    title="Refresh data"
                  />
                </div>
              </UiCard>
            </div>

        {/* Batch Processing Status */}
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card 
              className="shadow-sm"
              title={
                <div className="flex items-center gap-2">
                  {getBatchStatusIcon()}
                  <span>Batch Processing Status</span>
                </div>
              }
            >
              {batchStatus ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500">Type:</span>
                    <StatusChip kind="info" label={batchStatus.isManual ? 'Manual' : 'Automated'} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500">Status:</span>
                    {runStatusChip(batchStatus.status)}
                  </div>
                  {batchStatus.startedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Started:</span>
                      <span>{new Date(batchStatus.startedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {batchStatus.completedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Completed:</span>
                      <span>{new Date(batchStatus.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {batchStatus.durationSeconds && (
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Duration:</span>
                      <span>{batchStatus.durationSeconds}s</span>
                    </div>
                  )}
                  <Divider className="my-3" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{batchStatus.tipsProcessed}</div>
                      <div className="text-xs text-ink-500">Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{batchStatus.tipsFailed}</div>
                      <div className="text-xs text-ink-500">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-yellow-600">{batchStatus.tipsPending}</div>
                      <div className="text-xs text-ink-500">Pending</div>
                    </div>
                  </div>
                  <Divider className="my-3" />
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500">Total Amount:</span>
                    <span className="font-semibold text-lg">${batchStatus.totalAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                  {batchStatus.errorMessage && (
                    batchStatus.status === 'success' ? (
                      <div className="bg-slate-50 p-3 rounded border border-slate-200">
                        <p className="text-xs text-slate-700">{friendlyBatchNote(batchStatus.errorMessage)}</p>
                      </div>
                    ) : (
                      <div className="bg-red-50 p-3 rounded border border-red-200">
                        <p className="text-xs text-red-700"><strong>Why:</strong> {friendlyBatchNote(batchStatus.errorMessage)}</p>
                      </div>
                    )
                  )}
                  {batchStatus.failureDetails && batchStatus.failureDetails.length > 0 && (
                    <div className="bg-yellow-50 p-3 rounded border border-yellow-200 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-yellow-800 mb-2">Failure Details:</p>
                      <ul className="space-y-1">
                        {batchStatus.failureDetails.slice(0, 5).map((detail, idx) => (
                          <li key={idx} className="text-xs text-yellow-700">• {detail}</li>
                        ))}
                        {batchStatus.failureDetails.length > 5 && (
                          <li className="text-xs text-yellow-700">• ... and {batchStatus.failureDetails.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <Button 
                    block 
                    type="link" 
                    size="small"
                    onClick={loadBatchHistory}
                  >
                    View History
                  </Button>
                </div>
              ) : (
                <p className="text-ink-500">No batch runs yet</p>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card 
              className="shadow-sm"
              title="Batch History Summary"
            >
              {batchHistory.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batchHistory.slice(0, 10).map((run, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-surface rounded text-sm">
                      <div>
                        <div className="font-medium">{new Date(run.startedAt || '').toLocaleString()}</div>
                        <div className="text-xs text-ink-500">{run.tipsProcessed} processed, {run.tipsFailed} failed</div>
                      </div>
                      {runStatusChip(run.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ink-500 text-center py-4">No history available</p>
              )}
            </Card>
          </Col>
        </Row>

          </div>
        )}


        {activeTab === 'settings' && (
          <div className="space-y-5">
        {/* Stripe Mode Configuration */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={24}>
            <div className={`p-6 rounded-lg shadow-sm border ${
              stripeMode === 'live' && isProductionEnv 
                ? 'bg-red-50 border-red-300' 
                : stripeMode === 'test' && isProductionEnv 
                  ? 'bg-green-50 border-green-300'
                  : 'bg-surface border-slate-300'
            }`}>
              {stripeModeNotice && (
                <Alert
                  className="mb-4"
                  type={stripeModeNotice.type}
                  message={stripeModeNotice.text}
                  closable
                  onClose={() => setStripeModeNotice(null)}
                  showIcon
                />
              )}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {stripeMode === 'live' && isProductionEnv && (
                      <>
                        <span className="flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-600 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                        </span>
                        <h3 className="text-xl font-bold text-red-800">Stripe live mode is on</h3>
                      </>
                    )}
                    {stripeMode === 'test' && isProductionEnv && (
                      <>
                        <span className="inline-flex rounded-full h-3 w-3 bg-green-600"></span>
                        <h3 className="text-xl font-bold text-green-800">Stripe test mode</h3>
                      </>
                    )}
                    {!isProductionEnv && (
                      <>
                        <span className="inline-flex rounded-full h-3 w-3 bg-slate-600"></span>
                        <h3 className="text-xl font-bold text-ink-900">Development environment</h3>
                      </>
                    )}
                  </div>
                  <div className="space-y-1">
                    {stripeMode === 'live' && isProductionEnv && (
                      <>
                        <p className="text-red-700 font-semibold">All transactions are processing with REAL MONEY</p>
                        <p className="text-red-600 text-sm">• Customers will be charged actual amounts</p>
                        <p className="text-red-600 text-sm">• All Stripe fees apply</p>
                      </>
                    )}
                    {stripeMode === 'test' && isProductionEnv && (
                      <>
                        <p className="text-green-700 font-semibold">Safe to experiment - No real charges will be made</p>
                        <p className="text-green-600 text-sm">• Using Stripe test mode keys</p>
                        <p className="text-green-600 text-sm">• No actual money is processed</p>
                      </>
                    )}
                    {!isProductionEnv && (
                      <>
                        <p className="text-ink-700 font-semibold">Local development - Always uses TEST mode</p>
                        <p className="text-ink-500 text-sm">• Cannot switch to live mode in development</p>
                        <p className="text-ink-500 text-sm">• Deploy to production to enable live mode</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="ml-6">
                  {canToggleStripe && isProductionEnv && (
                    <Button 
                      type="primary"
                      size="large"
                      danger={stripeMode === 'test'}
                      ghost={stripeMode === 'live'}
                      onClick={handleToggleStripeMode}
                      loading={stripeModeLoading}
                      className={stripeMode === 'live' ? 'border-red-600 text-red-600 hover:bg-red-50' : ''}
                    >
                      {stripeMode === 'test' ? 'Enable live mode' : 'Switch to test mode'}
                    </Button>
                  )}
                  {!canToggleStripe && (
                    <div className="text-sm text-ink-500 text-center max-w-xs">
                      Mode toggle not available
                      {!isProductionEnv && ' in development'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Payment Security Limits (per environment) */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={24}>
            <Card title="Payment Security Limits" loading={rateLimitsLoading}>
              <p className="text-ink-500 mb-4">
                Maximum charge attempts allowed before a tip is blocked. These values apply to this environment only;
                resetting restores the defaults{rateLimitDefaults ? ` (${rateLimitDefaults.maxChargesPerHourPerUser} / ${rateLimitDefaults.maxChargesPerDayPerUser} / ${rateLimitDefaults.maxChargesPerHourPerPaymentMethod})` : ''}.
              </p>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <div className="mb-1 text-sm font-medium text-ink-700">Charges per user per hour</div>
                  <InputNumber
                    min={1}
                    max={1000000}
                    style={{ width: '100%' }}
                    value={rateLimits.maxChargesPerHourPerUser}
                    onChange={(value) => setRateLimits(prev => ({ ...prev, maxChargesPerHourPerUser: Number(value) || 1 }))}
                    disabled={rateLimitsSaving}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <div className="mb-1 text-sm font-medium text-ink-700">Charges per user per day</div>
                  <InputNumber
                    min={1}
                    max={1000000}
                    style={{ width: '100%' }}
                    value={rateLimits.maxChargesPerDayPerUser}
                    onChange={(value) => setRateLimits(prev => ({ ...prev, maxChargesPerDayPerUser: Number(value) || 1 }))}
                    disabled={rateLimitsSaving}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <div className="mb-1 text-sm font-medium text-ink-700">Charges per card per hour</div>
                  <InputNumber
                    min={1}
                    max={1000000}
                    style={{ width: '100%' }}
                    value={rateLimits.maxChargesPerHourPerPaymentMethod}
                    onChange={(value) => setRateLimits(prev => ({ ...prev, maxChargesPerHourPerPaymentMethod: Number(value) || 1 }))}
                    disabled={rateLimitsSaving}
                  />
                </Col>
              </Row>
              <Space className="mt-4">
                <Button type="primary" onClick={saveRateLimits} loading={rateLimitsSaving}>Save limits</Button>
                <Button onClick={resetRateLimits} disabled={rateLimitsSaving}>Reset to defaults</Button>
              </Space>
            </Card>
          </Col>
        </Row>

          </div>
        )}

        {/* Batch Procnt Tabs */}
        <Tabs activeKey={activeTab} renderTabBar={() => <></>}>
          <Tabs.TabPane tab="Tips" key="tips">
            {/* Tips Management */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card mb-6">
          
          {/* Filters */}
          <div className="space-y-4 mb-4">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Input 
                  placeholder="Search by device name, performer name, or email..." 
                  prefix={<SearchOutlined />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Select
                  placeholder="Filter by status..."
                  allowClear
                  value={filterStatus}
                  onChange={setFilterStatus}
                  className="w-full"
                  options={[
                    { label: 'Pending', value: 'pending' },
                    { label: 'Processed', value: 'processed' },
                    { label: 'Refunded', value: 'refunded' },
                    { label: 'Failed', value: 'failed' },
                    { label: 'Error', value: 'error' }
                  ]}
                />
              </Col>
              <Col xs={24} sm={12}>
                <RangePicker 
                  className="w-full"
                  placeholder={['Start Date', 'End Date']}
                  value={dateRange}
                  onChange={setDateRange}
                  format="YYYY-MM-DD"
                />
              </Col>
              <Col xs={24} sm={12}>
                <Space className="w-full">
                  <Input 
                    placeholder="Min Amount" 
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : undefined)}
                    style={{ width: '100px' }}
                  />
                  <Input 
                    placeholder="Max Amount" 
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : undefined)}
                    style={{ width: '100px' }}
                  />
                  <Button 
                    icon={<DownloadOutlined />}
                    onClick={exportTips}
                  >
                    Export CSV
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>

          {/* Tips Table */}
          <Spin spinning={tipsLoading}>
            <Table
              columns={[
                {
                  title: 'When',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (date: string) => <span className="whitespace-nowrap">{shortDate(date)}</span>,
                  width: 140
                },
                {
                  title: 'Amount',
                  dataIndex: 'amount',
                  key: 'amount',
                  render: (amount: number) => <span className="font-bold text-ink-900">${amount.toFixed(2)}</span>,
                  width: 90
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status: string, record: TipDetail) => (
                    <div>
                      {tipStatusChip(status)}
                      {status === 'processed' && record.processedAt && (
                        <div className="mt-1.5 text-xs text-ink-500">{shortDate(record.processedAt)}</div>
                      )}
                      {status === 'failed' && record.failureReason && (
                        <div className="mt-1.5 max-w-[260px] text-xs leading-snug text-ink-500" title={record.failureReason}>
                          {friendlyReason(record.failureReason)}
                        </div>
                      )}
                    </div>
                  ),
                  width: 250
                },
                {
                  title: 'Performer',
                  key: 'performer',
                  render: (_: unknown, record: TipDetail) => (
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900">{record.performerFirstName} {record.performerLastName}</div>
                      <div className="truncate text-xs text-ink-500">{record.deviceNickname} · {record.performerEmail}</div>
                    </div>
                  ),
                  width: 240
                },
                {
                  title: 'Performer gets',
                  dataIndex: 'performerEarnings',
                  key: 'performerEarnings',
                  align: 'right' as const,
                  render: (earnings: number) => `$${earnings.toFixed(2)}`,
                  width: 120
                },
                {
                  title: '',
                  key: 'refund',
                  width: 90,
                  align: 'right' as const,
                  render: (_: unknown, record: TipDetail) =>
                    isRefundEligible(record) ? (
                      <Button type="link" danger onClick={() => openRefundModal(record)}>
                        Refund
                      </Button>
                    ) : null
                }
              ]}
              dataSource={tips}
              rowKey="id"
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: totalTips,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: false,
                pageSizeOptions: ['20']
              }}
              scroll={{ x: 880 }}
            />
          </Spin>
          <Modal
            open={refundModalOpen}
            title="Refund this tip?"
            onClose={() => {
              if (!refundLoading) {
                setRefundModalOpen(false);
                setRefundTip(null);
              }
            }}
            footer={
              <>
                <UiButton
                  variant="secondary"
                  disabled={refundLoading}
                  onClick={() => {
                    setRefundModalOpen(false);
                    setRefundTip(null);
                  }}
                >
                  Keep tip
                </UiButton>
                <UiButton variant="dangerSolid" loading={refundLoading} onClick={handleRefundConfirm}>
                  Refund
                </UiButton>
              </>
            }
          >
            {refundTip && (
              <div className="text-ink-700">
                <p>
                  Refund <strong className="text-ink-900">${refundTip.amount.toFixed(2)}</strong> to the card that paid for this tip. It counts against{' '}
                  {refundTip.performerFirstName} {refundTip.performerLastName}.
                </p>
                <p className="mt-2 text-sm text-ink-500">Tipped {new Date(refundTip.createdAt).toLocaleString()}</p>
              </div>
            )}
          </Modal>
        </div>

          </Tabs.TabPane>
          <Tabs.TabPane tab="Performers" key="performers">
        {/* Performers Management */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-ink-900">All performers</h3>
            <Search
              placeholder="Search performers..."
              onSearch={handleSearch}
              style={{ width: 300 }}
              allowClear
            />
          </div>
          <Table
            columns={performerColumns}
            dataSource={performers}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total: number, range: [number, number]) => 
                `${range[0]}-${range[1]} of ${total} performers`,
            }}
            scroll={{ x: 800 }}
          />
        </div>
          </Tabs.TabPane>

          {/* Performer Insights Tab */}
          <Tabs.TabPane tab="Performer Insights" key="performer-insights">
            <PerformerInsights />
          </Tabs.TabPane>

          {userProfile?.role === 'root_admin' && (
            <Tabs.TabPane tab="Device Management" key="device-management">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-ink-900">Performer Device Management</h3>
                  <p className="text-sm text-ink-500">
                    Search by first name, last name, public name, or device serial number.
                  </p>
                </div>
                <Search
                  placeholder="Search performers or devices..."
                  value={deviceSearchTerm}
                  onChange={(e) => setDeviceSearchTerm(e.target.value)}
                  onSearch={(value) => {
                    const trimmed = value.trim();
                    if (!trimmed) return;
                    loadPerformerDevices(trimmed);
                  }}
                  style={{ width: 320 }}
                  allowClear
                />
              </div>

              <Spin spinning={deviceSearchLoading}>
                {deviceSearchResults.length === 0 ? (
                  <p className="text-ink-500">
                    {deviceSearchTerm.trim()
                      ? 'No performers or devices found for that search.'
                      : 'No results yet. Run a search to see devices.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {deviceSearchResults.map((performer) => (
                      <Card
                        key={performer.id}
                        className="shadow-sm"
                        title={
                          <div className="flex flex-col">
                            <span className="font-semibold text-ink-900">
                              {performer.firstName} {performer.lastName}
                            </span>
                            <span className="text-xs text-ink-500">
                              {performer.stageName ? `Public Name: ${performer.stageName}` : 'Public Name: —'}
                            </span>
                          </div>
                        }
                      >
                        <div className="text-sm text-ink-500 mb-4">
                          Email: {performer.email}
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                          <Select
                            showSearch
                            placeholder="Search available serial number..."
                            value={selectedSerials[performer.id]}
                            onSearch={loadAvailableSerials}
                            onChange={(value) =>
                              setSelectedSerials((prev) => ({
                                ...prev,
                                [performer.id]: value
                              }))
                            }
                            filterOption={false}
                            notFoundContent={
                              serialSearchLoading ? <Spin size="small" /> : 'No devices found'
                            }
                            options={availableSerials.map((serial) => ({
                              label: serial,
                              value: serial
                            }))}
                            className="w-full md:w-72"
                          />
                          <Button
                            type="primary"
                            onClick={() => {
                              const serial = selectedSerials[performer.id];
                              if (serial) {
                                openAddDeviceModal(performer, serial);
                              }
                            }}
                            disabled={!selectedSerials[performer.id]}
                          >
                            Add Device
                          </Button>
                        </div>

                        <Table
                          columns={[
                            {
                              title: 'Serial Number',
                              dataIndex: 'serialNumber',
                              key: 'serialNumber',
                              render: (serial) => serial || '—'
                            },
                            {
                              title: 'Nickname',
                              dataIndex: 'nickname',
                              key: 'nickname',
                              render: (nickname) => nickname || '—'
                            },
                            {
                              title: 'Added',
                              dataIndex: 'createdAt',
                              key: 'createdAt',
                              render: (date) => new Date(date).toLocaleDateString()
                            },
                            {
                              title: 'Actions',
                              key: 'actions',
                              render: (_: unknown, record: PerformerDeviceSummary) => (
                                <Button
                                  danger
                                  size="small"
                                  onClick={() =>
                                    openDeleteDeviceModal(
                                      performer,
                                      record.id,
                                      record.serialNumber || 'Unknown'
                                    )
                                  }
                                >
                                  Delete
                                </Button>
                              )
                            }
                          ]}
                          dataSource={performer.devices}
                          rowKey="id"
                          pagination={false}
                          size="small"
                          locale={{ emptyText: 'No devices assigned' }}
                        />
                      </Card>
                    ))}
                  </div>
                )}
              </Spin>
              </div>
            </Tabs.TabPane>
          )}

          {isSimulationVisible && (
            <Tabs.TabPane tab="Device Tip Simulation" key="device-tip-simulation">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-ink-900">Device Tip Simulation</h3>
                    <p className="text-sm text-ink-500">
                      Available only on local and apptest environments.
                    </p>
                  </div>
                  <div className="text-sm text-ink-500">
                    <span className="font-semibold">Elapsed:</span> {formatSimulationTime(simulationElapsed)} ·{' '}
                    <span className="font-semibold">Tips:</span> {simulationTipCount}
                  </div>
                </div>

                {simulationError && (
                  <Alert type="error" showIcon message={simulationError} className="mb-4" />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">Device Serial Number</label>
                    <Select
                      showSearch
                      placeholder="Search device serial or performer..."
                      value={selectedSimulationDevice?.serialNumber}
                      onSearch={(value) => {
                        loadSimulationDevices(value);
                      }}
                      onChange={(value) => {
                        const device = simulationDevices.find((d) => d.serialNumber === value) || null;
                        setSelectedSimulationDevice(device);
                      }}
                      filterOption={false}
                      loading={simulationLoading}
                      options={simulationDevices.map((device) => ({
                        label: `${device.serialNumber} · ${device.performerName}`,
                        value: device.serialNumber
                      }))}
                      className="w-full"
                      disabled={simulationRunning}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">Tip Frequency</label>
                    <Select
                      value={simulationFrequency}
                      onChange={(value) => setSimulationFrequency(value)}
                      className="w-full"
                      disabled={simulationRunning}
                      options={[
                        { label: '2 seconds', value: 2000 },
                        { label: '4 seconds', value: 4000 },
                        { label: '6 seconds', value: 6000 },
                        { label: '8 seconds', value: 8000 },
                        { label: '10 seconds', value: 10000 },
                        { label: '15 seconds', value: 15000 },
                        { label: '20 seconds', value: 20000 }
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">Tipper Mode</label>
                    <Select
                      value={simulationPaymentMode}
                      onChange={(value) => {
                        setSimulationPaymentMode(value);
                        simulationTippersRef.current = null;
                      }}
                      className="w-full"
                      disabled={simulationRunning}
                      options={[
                        { label: 'PayWallet', value: 'paywallet' },
                        { label: 'Manual', value: 'manual' },
                        { label: 'Auto', value: 'auto' }
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">Denomination</label>
                    <Select
                      value={simulationAmountMode}
                      onChange={(value) => setSimulationAmountMode(value)}
                      className="w-full"
                      disabled={simulationRunning}
                      options={[
                        { label: 'Auto', value: 'auto' },
                        { label: '$2', value: 2 },
                        { label: '$5', value: 5 },
                        { label: '$10', value: 10 },
                        { label: '$20', value: 20 },
                        { label: '$50', value: 50 },
                        { label: '$100', value: 100 }
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="primary" onClick={startSimulation} disabled={simulationRunning || simulationLoading}>
                    Start
                  </Button>
                  <Button onClick={stopSimulation} disabled={!simulationRunning}>
                    Stop
                  </Button>
                  <Button danger onClick={cancelSimulation} disabled={simulationRunning && simulationTipCount === 0}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Tabs.TabPane>
          )}

          <Tabs.TabPane tab="Aggregated Charges" key="aggregated-charges">
            <div className="space-y-5">
              <RecoverChargedTips />
              <MarkDemoTips />
              <ClearFailedTestTips />
              <AggregatedChargesTable />
            </div>
          </Tabs.TabPane>
        </Tabs>

        {/* Update Fee Modal */}
        <Modal
          open={updateFeeModal}
          title="Update platform fee"
          onClose={() => {
            setUpdateFeeModal(false);
            setSelectedPerformer(null);
          }}
          footer={
            <>
              <UiButton
                variant="secondary"
                onClick={() => {
                  setUpdateFeeModal(false);
                  setSelectedPerformer(null);
                }}
              >
                Cancel
              </UiButton>
              <UiButton loading={updatingFee} onClick={handleUpdateFee}>
                Save fee
              </UiButton>
            </>
          }
        >
          {selectedPerformer && (
            <div className="space-y-5">
              <p className="text-ink-700">
                Platform fee for <strong className="text-ink-900">{selectedPerformer.firstName} {selectedPerformer.lastName}</strong>. It is now{' '}
                {selectedPerformer.platformFeePercentage}%.
              </p>
              <div>
                <label htmlFor="fee-pct" className="mb-1.5 block text-sm font-semibold text-ink-700">New fee (%)</label>
                <input
                  id="fee-pct"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={newFeePercentage}
                  onChange={(e) => setNewFeePercentage(Number(e.target.value))}
                  className='h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-ink-900 placeholder:text-ink-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500'
                />
                <p className="mt-1.5 text-sm text-ink-500">A value between 0.01 and 100. It applies to new tips.</p>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={!!pendingDeviceAction}
          title={pendingDeviceAction?.type === 'add' ? 'Add this device?' : 'Delete this device?'}
          onClose={() => {
            if (!deviceActionLoading) setPendingDeviceAction(null);
          }}
          footer={
            <>
              <UiButton variant="secondary" disabled={deviceActionLoading} onClick={() => setPendingDeviceAction(null)}>
                Cancel
              </UiButton>
              <UiButton
                variant={pendingDeviceAction?.type === 'add' ? 'primary' : 'dangerSolid'}
                loading={deviceActionLoading}
                onClick={() => runDeviceAction(notifyPerformer)}
              >
                {pendingDeviceAction?.type === 'add' ? 'Add device' : 'Delete device'}
              </UiButton>
            </>
          }
        >
          {pendingDeviceAction && (
            <div className="space-y-4 text-ink-700">
              <p>
                {pendingDeviceAction.type === 'add' ? 'You are adding a device to' : 'You are deleting a device from'}
              </p>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <div className="font-semibold text-ink-900">
                  {pendingDeviceAction.performer.firstName} {pendingDeviceAction.performer.lastName}
                </div>
                <div className="text-sm text-ink-500">{pendingDeviceAction.performer.email}</div>
                <div className="mt-2 text-sm">
                  Serial number <strong className="text-ink-900">{pendingDeviceAction.serialNumber}</strong>
                </div>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-700">Tell the performer?</legend>
                {[
                  { value: true, label: 'Yes, send them an email' },
                  { value: false, label: 'No, do it quietly' }
                ].map(opt => (
                  <label key={String(opt.value)} className="flex cursor-pointer items-center gap-3 py-1.5">
                    <input
                      type="radio"
                      name="notify-performer"
                      checked={notifyPerformer === opt.value}
                      onChange={() => setNotifyPerformer(opt.value)}
                      className="h-5 w-5 accent-brand-700"
                    />
                    {opt.label}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
        </Modal>

        {/* Batch History Modal */}
        <Modal
          open={batchHistoryModal}
          wide
          title="Batch processing history"
          onClose={() => setBatchHistoryModal(false)}
          footer={<UiButton onClick={() => setBatchHistoryModal(false)}>Done</UiButton>}
        >
          <Table
            columns={[
              {
                title: 'Started',
                dataIndex: 'startedAt',
                key: 'startedAt',
                render: (date: string) => <span className="font-semibold text-ink-900">{shortDate(date)}</span>,
                width: 140
              },
              {
                title: 'Result',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => runStatusChip(status),
                width: 110
              },
              {
                title: 'Tips',
                key: 'tips',
                render: (_: unknown, run: { tipsProcessed: number; tipsFailed: number }) => (
                  <span className="whitespace-nowrap">
                    <span className="font-semibold text-ink-900">{run.tipsProcessed}</span> charged
                    {run.tipsFailed > 0 && (
                      <>
                        {' · '}
                        <span className="font-semibold" style={{ color: 'var(--tone-error-fg)' }}>{run.tipsFailed}</span> failed
                      </>
                    )}
                  </span>
                ),
                width: 170
              },
              {
                title: 'Total',
                dataIndex: 'totalAmount',
                key: 'totalAmount',
                align: 'right' as const,
                render: (amount: number) => <span className="font-bold text-ink-900">${(amount ?? 0).toFixed(2)}</span>,
                width: 90
              },
              {
                title: 'Took',
                dataIndex: 'durationSeconds',
                key: 'durationSeconds',
                render: (seconds: number) => (seconds ? `${seconds}s` : '—'),
                width: 60
              },
              {
                title: 'Note',
                dataIndex: 'errorMessage',
                key: 'errorMessage',
                render: (msg: string | null) =>
                  msg ? <span className="text-xs leading-snug text-ink-500" title={msg}>{friendlyBatchNote(msg)}</span> : <span className="text-ink-400">—</span>,
                width: 240
              }
            ]}
            dataSource={batchHistory}
            rowKey="id"
            pagination={false}
            scroll={{ x: 800 }}
          />
        </Modal>

        {/* Stripe Mode Toggle Confirmation Modal */}
        <Modal
          open={stripeModeConfirming}
          title={stripeMode === 'test' ? 'Enable live mode?' : 'Switch to test mode?'}
          onClose={() => setStripeModeConfirming(false)}
          footer={
            <>
              <UiButton variant="secondary" onClick={() => setStripeModeConfirming(false)}>
                Cancel
              </UiButton>
              <UiButton
                variant={stripeMode === 'test' ? 'dangerSolid' : 'primary'}
                loading={stripeModeLoading}
                disabled={stripeMode === 'test' && liveConfirmText.trim() !== 'LIVE'}
                onClick={confirmToggleStripeMode}
              >
                {stripeMode === 'test' ? 'Enable live mode' : 'Switch to test mode'}
              </UiButton>
            </>
          }
        >
          <div className="space-y-4">
            {stripeModeError && (
              <Banner tone="error" title="That did not work">
                {stripeModeError}
              </Banner>
            )}

            {stripeMode === 'test' ? (
              <>
                <Banner tone="error" title="This uses real money">
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>Every tip is charged to a real card</li>
                    <li>Stripe fees apply</li>
                    <li>It changes the whole platform right away</li>
                  </ul>
                </Banner>
                <div>
                  <label htmlFor="live-confirm" className="mb-1.5 block text-sm font-semibold text-ink-700">
                    To confirm, type <strong>LIVE</strong>
                  </label>
                  <input
                    id="live-confirm"
                    value={liveConfirmText}
                    onChange={(e) => setLiveConfirmText(e.target.value)}
                    placeholder="LIVE"
                    autoFocus
                    className='h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-ink-900 placeholder:text-ink-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500'
                  />
                </div>
              </>
            ) : (
              <Banner tone="success" title="Back to test mode">
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>No real charges are made</li>
                  <li>Test Stripe keys are used</li>
                  <li>Safe for testing</li>
                </ul>
              </Banner>
            )}
          </div>
        </Modal>
      </div>
    </PortalShell>
  );
};

export default AdminDashboard;
