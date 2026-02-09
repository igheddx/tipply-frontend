import logger from "../utils/logger";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Statistic, Table, Button, Input, Modal, message, Spin, Card, Tag, Select, DatePicker, Space, Divider, Alert, Tabs, Radio } from 'antd';
import { 
  UserOutlined, 
  DesktopOutlined, 
  DollarOutlined, 
  ReloadOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  DownloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { apiService } from '../services/api';
import { isRefundEligible } from '../utils/refunds';
import AggregatedChargesTable from '../components/AggregatedChargesTable';
import dayjs from 'dayjs';

const { Search } = Input;
const { RangePicker } = DatePicker;

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

const AdminDashboard: React.FC = () => {
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
  const [stripeModeError, setStripeModeError] = useState<string | null>(null);
  const [stripeModeNotice, setStripeModeNotice] = useState<{ type: 'success' | 'warning' | 'error' | 'info'; text: string } | null>(null);

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
      message.error('Access denied. Admin privileges required.');
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
      message.error('Failed to load admin dashboard data');
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
      message.error('Failed to search performers');
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
      message.error('Failed to update platform fee');
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

  const handleToggleStripeMode = () => {
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
      message.error('Failed to load batch history');
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
      message.error('Failed to load tips');
    } finally {
      setTipsLoading(false);
    }
  };

  const loadPerformerDevices = async (search: string) => {
    try {
      setDeviceSearchLoading(true);
      const response = await apiService.get(`/api/admin/performers/search-devices?q=${encodeURIComponent(search)}`);
      if (response.data) {
        setDeviceSearchResults(response.data);
      }
    } catch (error) {
      logger.error('Error searching performers/devices:', error);
      message.error('Failed to search performers/devices');
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

      if (deviceSearchTerm.trim()) {
        await loadPerformerDevices(deviceSearchTerm.trim());
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Device action failed';
      logger.error('Error performing device action:', error);
      message.error(errorMsg);
    } finally {
      setDeviceActionLoading(false);
      setPendingDeviceAction(null);
    }
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
      message.error(errorMsg);
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
      message.error('Failed to export tips');
    }
  };

  const getBatchStatusColor = () => {
    if (!batchStatus) return 'default';
    if (batchStatus.status === 'success') return 'success';
    if (batchStatus.status === 'failed') return 'error';
    if (batchStatus.status === 'running') return 'processing';
    return 'default';
  };

  const getBatchStatusIcon = () => {
    if (!batchStatus) return null;
    if (batchStatus.status === 'success') return <CheckCircleOutlined />;
    if (batchStatus.status === 'failed') return <CloseCircleOutlined />;
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
            <div className="text-sm text-gray-500">@{record.stageName}</div>
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
          <div className="font-medium text-blue-600">{record.platformFeePercentage}%</div>
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
          <div className="text-sm text-gray-500">
            Platform: ${record.totalPlatformFees.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: PerformerSummary) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          record.isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {record.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-1">{/* Left side - Logo */}
            <div className="flex items-center">
              <div className="relative w-12 h-12 overflow-visible rounded-lg">
                <img
                  src="/images/logo/tipwave-logo2b.png"
                  alt="Tipwave Logo"
                  className="w-full h-full object-contain"
                  style={{ transform: 'scale(2.4)', objectPosition: 'center' }}
                />
              </div>
            </div>

            {/* Right side - Buttons */}
            <div className="flex items-center space-x-4">
              <Button 
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/dashboard')}
                className="flex items-center"
              >
                Back to Dashboard
              </Button>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('refreshToken');
                  navigate('/login');
                }}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Logout"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Dashboard, Welcome {userProfile?.firstName || userProfile?.stageName || 'Admin'}! 👋
          </h2>
          <p className="text-gray-600">
            System overview and performer management
          </p>
        </div>

        {/* Stats Cards */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={24} sm={12} lg={6}>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <Statistic
                title="Total Users"
                value={stats?.totalUsers || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <Statistic
                title="Total Devices"
                value={stats?.totalDevices || 0}
                prefix={<DesktopOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <Statistic
                title="Total Tips"
                value={stats?.totalTips || 0}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <Statistic
                title="Active Performers"
                value={stats?.activePerformers || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </div>
          </Col>
        </Row>

        {/* Financial Overview */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={24} lg={8}>
            <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Revenue (processed):</span>
                  <span className="font-semibold text-lg text-green-600">
                    ${stats?.totalRevenue?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Performer Payouts:</span>
                  <span className="font-semibold text-blue-600">
                    ${stats?.totalPerformerPayouts?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Earnings</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Platform Fee (YTD):</span>
                  <span className="font-semibold text-blue-600">
                    ${platformEarnings?.totalPlatformFees?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Stripe Fees (actual):</span>
                  <span className="font-semibold text-orange-600">
                    ${platformEarnings?.totalPaymentPartnerFees?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Net Earnings (platform fees - Stripe fees):</span>
                  <span className="font-semibold text-green-600">
                    ${platformEarnings?.netPlatformEarnings?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
              {batchResultMessage && (
                <Alert
                  className="mb-4"
                  type={batchResultMessage.type}
                  message={batchResultMessage.text}
                  showIcon
                  closable
                  onClose={() => setBatchResultMessage(null)}
                />
              )}
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button 
                  type="primary" 
                  icon={batchProcessing ? <ReloadOutlined spin /> : <PlayCircleOutlined />}
                  onClick={(e) => {
                    e.preventDefault();
                    runBatchProcessing();
                  }}
                  loading={batchProcessing}
                  disabled={batchProcessing}
                  className="w-full"
                >
                  {batchProcessing ? 'Running...' : 'Run Batch Processing'}
                </Button>
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setBatchResultMessage(null);
                    loadDashboardData();
                  }}
                  className="w-full"
                >
                  Refresh Data
                </Button>
                <div className="text-sm text-gray-500 text-center">
                  {stats?.pendingTips || 0} pending tips
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Stripe Mode Configuration */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={24}>
            <div className={`p-6 rounded-lg shadow-sm border ${
              stripeMode === 'live' && isProductionEnv 
                ? 'bg-red-50 border-red-300' 
                : stripeMode === 'test' && isProductionEnv 
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-300'
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
                        <h3 className="text-xl font-bold text-red-800">⚠️ STRIPE LIVE MODE ACTIVE</h3>
                      </>
                    )}
                    {stripeMode === 'test' && isProductionEnv && (
                      <>
                        <span className="inline-flex rounded-full h-3 w-3 bg-green-600"></span>
                        <h3 className="text-xl font-bold text-green-800">✓ STRIPE TEST MODE</h3>
                      </>
                    )}
                    {!isProductionEnv && (
                      <>
                        <span className="inline-flex rounded-full h-3 w-3 bg-gray-600"></span>
                        <h3 className="text-xl font-bold text-gray-800">🛠️ DEVELOPMENT ENVIRONMENT</h3>
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
                        <p className="text-gray-700 font-semibold">Local development - Always uses TEST mode</p>
                        <p className="text-gray-600 text-sm">• Cannot switch to live mode in development</p>
                        <p className="text-gray-600 text-sm">• Deploy to production to enable live mode</p>
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
                      {stripeMode === 'test' ? '🔴 Enable Live Mode' : '🟢 Switch to Test Mode'}
                    </Button>
                  )}
                  {!canToggleStripe && (
                    <div className="text-sm text-gray-500 text-center max-w-xs">
                      Mode toggle not available
                      {!isProductionEnv && ' in development'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Batch Processing Status */}
        <Row gutter={16} className="mb-6">
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
                    <span className="text-gray-600">Type:</span>
                    <Tag color={batchStatus.isManual ? 'blue' : 'purple'}>
                      {batchStatus.isManual ? 'MANUAL' : 'AUTOMATED'}
                    </Tag>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Status:</span>
                    <Tag color={getBatchStatusColor()}>{batchStatus.status?.toUpperCase() || 'UNKNOWN'}</Tag>
                  </div>
                  {batchStatus.startedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Started:</span>
                      <span>{new Date(batchStatus.startedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {batchStatus.completedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Completed:</span>
                      <span>{new Date(batchStatus.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {batchStatus.durationSeconds && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Duration:</span>
                      <span>{batchStatus.durationSeconds}s</span>
                    </div>
                  )}
                  <Divider className="my-3" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{batchStatus.tipsProcessed}</div>
                      <div className="text-xs text-gray-500">Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{batchStatus.tipsFailed}</div>
                      <div className="text-xs text-gray-500">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-yellow-600">{batchStatus.tipsPending}</div>
                      <div className="text-xs text-gray-500">Pending</div>
                    </div>
                  </div>
                  <Divider className="my-3" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-semibold text-lg">${batchStatus.totalAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                  {batchStatus.errorMessage && (
                    <div className="bg-red-50 p-3 rounded border border-red-200">
                      <p className="text-xs text-red-700"><strong>Error:</strong> {batchStatus.errorMessage}</p>
                    </div>
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
                <p className="text-gray-500">No batch runs yet</p>
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
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                      <div>
                        <div className="font-medium">{new Date(run.startedAt || '').toLocaleString()}</div>
                        <div className="text-xs text-gray-500">{run.tipsProcessed} processed, {run.tipsFailed} failed</div>
                      </div>
                      <Tag color={run.status === 'success' ? 'green' : run.status === 'failed' ? 'red' : 'orange'}>
                        {run.status}
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No history available</p>
              )}
            </Card>
          </Col>
        </Row>

        {/* Main Content Tabs */}
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="Overview" key="overview">
            {/* Tips Management */}
            <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips Management</h3>
          
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
                  title: 'Refund',
                  key: 'refund',
                  width: 90,
                  render: (_: unknown, record: TipDetail) =>
                    isRefundEligible(record) ? (
                      <Button type="link" danger onClick={() => openRefundModal(record)}>
                        Refund
                      </Button>
                    ) : (
                      '-'
                    )
                },
                {
                  title: 'Created At',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (date) => new Date(date).toLocaleString(),
                  width: 180
                },
                {
                  title: 'Processed At',
                  dataIndex: 'processedAt',
                  key: 'processedAt',
                  render: (date) => date ? new Date(date).toLocaleString() : '-',
                  width: 180
                },
                {
                  title: 'Amount',
                  dataIndex: 'amount',
                  key: 'amount',
                  render: (amount) => `$${amount.toFixed(2)}`,
                  width: 100
                },
                {
                  title: 'Device',
                  dataIndex: 'deviceNickname',
                  key: 'deviceNickname',
                  width: 150
                },
                {
                  title: 'Performer',
                  key: 'performer',
                  render: (_, record: TipDetail) => `${record.performerFirstName} ${record.performerLastName}`,
                  width: 150
                },
                {
                  title: 'Email',
                  dataIndex: 'performerEmail',
                  key: 'performerEmail',
                  width: 200,
                  ellipsis: true
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => {
                    let color = 'default';
                    if (status === 'processed') color = 'green';
                    if (status === 'failed' || status === 'error') color = 'red';
                    if (status === 'pending') color = 'orange';
                    if (status === 'refunded') color = 'blue';
                    return <Tag color={color}>{status.toUpperCase()}</Tag>;
                  },
                  width: 100
                },
                {
                  title: 'Effect',
                  dataIndex: 'effect',
                  key: 'effect',
                  width: 80
                },
                {
                  title: 'Performer Earnings',
                  dataIndex: 'performerEarnings',
                  key: 'performerEarnings',
                  render: (earnings) => `$${earnings.toFixed(2)}`,
                  width: 130
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
              scroll={{ x: 1500 }}
              size="small"
            />
          </Spin>
          <Modal
            title="Confirm refund"
            open={refundModalOpen}
            onOk={handleRefundConfirm}
            onCancel={() => {
              if (!refundLoading) {
                setRefundModalOpen(false);
                setRefundTip(null);
              }
            }}
            confirmLoading={refundLoading}
            okText="Refund"
            okButtonProps={{ danger: true }}
          >
            {refundTip && (
              <div className="text-gray-700">
                <p>
                  Refund ${refundTip.amount.toFixed(2)} to {refundTip.performerFirstName} {refundTip.performerLastName}?
                </p>
                <p className="text-sm text-gray-500">
                  Created: {new Date(refundTip.createdAt).toLocaleString()}
                </p>
              </div>
            )}
          </Modal>
        </div>

        {/* Performers Management */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performers Management</h3>
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

          {userProfile?.role === 'root_admin' && (
            <Tabs.TabPane tab="Device Management" key="device-management">
              <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Performer Device Management</h3>
                  <p className="text-sm text-gray-500">
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
                  <p className="text-gray-500">
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
                            <span className="font-semibold text-gray-900">
                              {performer.firstName} {performer.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {performer.stageName ? `Public Name: ${performer.stageName}` : 'Public Name: —'}
                            </span>
                          </div>
                        }
                      >
                        <div className="text-sm text-gray-600 mb-4">
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

          <Tabs.TabPane tab="Aggregated Charges" key="aggregated-charges">
            <AggregatedChargesTable />
          </Tabs.TabPane>
        </Tabs>

        {/* Update Fee Modal */}
        <Modal
          title="Update Platform Fee"
          open={updateFeeModal}
          onOk={handleUpdateFee}
          onCancel={() => {
            setUpdateFeeModal(false);
            setSelectedPerformer(null);
          }}
          confirmLoading={updatingFee}
        >
          {selectedPerformer && (
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 mb-2">
                  Update platform fee for <strong>{selectedPerformer.firstName} {selectedPerformer.lastName}</strong>
                </p>
                <p className="text-sm text-gray-500">
                  Current fee: {selectedPerformer.platformFeePercentage}%
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Platform Fee Percentage
                </label>
                <Input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={newFeePercentage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFeePercentage(Number(e.target.value))}
                  suffix="%"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a value between 0.01% and 100%
                </p>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          title={pendingDeviceAction?.type === 'add' ? 'Confirm Device Add' : 'Confirm Device Deletion'}
          open={!!pendingDeviceAction}
          okText="Continue"
          cancelText="Cancel"
          confirmLoading={deviceActionLoading}
          onOk={() => runDeviceAction(notifyPerformer)}
          onCancel={() => {
            if (!deviceActionLoading) {
              setPendingDeviceAction(null);
            }
          }}
        >
          {pendingDeviceAction && (
            <div className="text-gray-700">
              <p className="mb-2">
                {pendingDeviceAction.type === 'add'
                  ? 'You are about to add a device to:'
                  : 'You are about to delete a device from:'}
              </p>
              <p className="font-semibold">
                {pendingDeviceAction.performer.firstName} {pendingDeviceAction.performer.lastName}
              </p>
              <p className="text-sm text-gray-500">{pendingDeviceAction.performer.email}</p>
              <p className="mt-3">
                Device Serial Number: <strong>{pendingDeviceAction.serialNumber}</strong>
              </p>
              <div className="mt-4">
                <Radio.Group
                  onChange={(e) => setNotifyPerformer(e.target.value === 'notify')}
                  value={notifyPerformer ? 'notify' : 'no-notify'}
                >
                  <Space direction="vertical">
                    <Radio value="notify">Notify performer</Radio>
                    <Radio value="no-notify">Do not notify performer</Radio>
                  </Space>
                </Radio.Group>
              </div>
            </div>
          )}
        </Modal>

        {/* Batch History Modal */}
        <Modal
          title="Batch Processing History"
          open={batchHistoryModal}
          onCancel={() => setBatchHistoryModal(false)}
          footer={null}
          width={900}
        >
          <Table
            columns={[
              {
                title: 'Started At',
                dataIndex: 'startedAt',
                key: 'startedAt',
                render: (date) => new Date(date).toLocaleString(),
                width: 180
              },
              {
                title: 'Completed At',
                dataIndex: 'completedAt',
                key: 'completedAt',
                render: (date) => date ? new Date(date).toLocaleString() : '-',
                width: 180
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status) => {
                  let color = 'default';
                  if (status === 'success') color = 'green';
                  if (status === 'failed') color = 'red';
                  if (status === 'running') color = 'orange';
                  return <Tag color={color}>{status.toUpperCase()}</Tag>;
                }
              },
              {
                title: 'Processed',
                dataIndex: 'tipsProcessed',
                key: 'tipsProcessed',
                render: (num) => <span className="text-green-600 font-medium">{num}</span>
              },
              {
                title: 'Failed',
                dataIndex: 'tipsFailed',
                key: 'tipsFailed',
                render: (num) => <span className="text-red-600 font-medium">{num}</span>
              },
              {
                title: 'Total',
                dataIndex: 'totalAmount',
                key: 'totalAmount',
                render: (amount) => `$${amount.toFixed(2)}`
              },
              {
                title: 'Duration',
                dataIndex: 'durationSeconds',
                key: 'durationSeconds',
                render: (seconds) => seconds ? `${seconds}s` : '-'
              }
            ]}
            dataSource={batchHistory}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Modal>

        {/* Stripe Mode Toggle Confirmation Modal */}
        <Modal
          title={stripeMode === 'test' ? '⚠️ Enable Live Mode' : '✓ Switch to Test Mode'}
          open={stripeModeConfirming}
          onOk={confirmToggleStripeMode}
          onCancel={() => setStripeModeConfirming(false)}
          okText={stripeMode === 'test' ? 'Enable Live Mode' : 'Switch to Test Mode'}
          cancelText="Cancel"
          okButtonProps={{ 
            danger: stripeMode === 'test',
            loading: stripeModeLoading
          }}
        >
          {stripeModeError && (
            <Alert
              type="error"
              showIcon
              message={stripeModeError}
              style={{ marginBottom: 16 }}
            />
          )}

          {stripeMode === 'test' ? (
            <div className="space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Warning: Production Mode</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>You are about to enable <strong>LIVE MODE</strong>. This means:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>All transactions will process <strong>REAL MONEY</strong></li>
                        <li>Customers will be charged actual amounts</li>
                        <li>All Stripe fees will apply</li>
                        <li>This change affects the entire platform immediately</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-gray-700">
                Are you absolutely sure you want to switch to live mode?
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border-l-4 border-green-500 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Switching to Test Mode</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>This will switch the system back to test mode where:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>No real charges will be processed</li>
                        <li>Safe to test and experiment</li>
                        <li>Test Stripe keys will be used</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-gray-700">
                Confirm switching to test mode?
              </p>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default AdminDashboard;
