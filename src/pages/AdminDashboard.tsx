import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Statistic, Table, Button, Input, Modal, message, Spin } from 'antd';
import { 
  UserOutlined, 
  DesktopOutlined, 
  DollarOutlined, 
  ReloadOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { apiService } from '../services/api';

const { Search } = Input;

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

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [performers, setPerformers] = useState<PerformerSummary[]>([]);
  const [platformEarnings, setPlatformEarnings] = useState<PlatformEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [updateFeeModal, setUpdateFeeModal] = useState(false);
  const [selectedPerformer, setSelectedPerformer] = useState<PerformerSummary | null>(null);
  const [newFeePercentage, setNewFeePercentage] = useState<number>(10);
  const [updatingFee, setUpdatingFee] = useState(false);

  useEffect(() => {
    // Check if user has admin role
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'root_admin') {
          message.error('Access denied. Admin privileges required.');
          navigate('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Error decoding token:', error);
        message.error('Invalid authentication token.');
        navigate('/login');
        return;
      }
    } else {
      navigate('/login');
      return;
    }

    loadDashboardData();
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, performersResponse, earningsResponse] = await Promise.all([
        apiService.get('/api/admin/dashboard-stats'),
        apiService.get('/api/admin/performers'),
        apiService.get('/api/admin/platform-earnings')
      ]);

      if (statsResponse.data) setStats(statsResponse.data);
      if (performersResponse.data) setPerformers(performersResponse.data);
      if (earningsResponse.data) setPlatformEarnings(earningsResponse.data);
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
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
      console.error('Error searching performers:', error);
      message.error('Failed to search performers');
    }
  };

  const handleUpdateFee = async () => {
    if (!selectedPerformer) return;

    try {
      setUpdatingFee(true);
      await apiService.put(`/admin/performers/${selectedPerformer.id}/platform-fee`, {
        platformFeePercentage: newFeePercentage
      });

      message.success(`Platform fee updated to ${newFeePercentage}%`);
      setUpdateFeeModal(false);
      setSelectedPerformer(null);
      setNewFeePercentage(10);
      
      // Reload data to reflect changes
      loadDashboardData();
    } catch (error) {
      console.error('Error updating platform fee:', error);
      message.error('Failed to update platform fee');
    } finally {
      setUpdatingFee(false);
    }
  };

  const runBatchProcessing = async () => {
    try {
      const result = await apiService.post('/api/admin/batch-process');
      if (result.data?.message) {
        message.success(result.data.message);
      } else {
        message.success('Batch processing completed');
      }
      loadDashboardData(); // Reload to get updated stats
    } catch (error) {
      console.error('Error running batch processing:', error);
      message.error('Failed to run batch processing');
    }
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
              <p className="text-gray-600">System overview and performer management</p>
            </div>
            <Button 
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/dashboard')}
              className="flex items-center"
            >
              Back to Dashboard
            </Button>
          </div>
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
                  <span className="text-gray-600">Total Revenue:</span>
                  <span className="font-semibold text-lg text-green-600">
                    ${stats?.totalRevenue?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Fees (10%):</span>
                  <span className="font-semibold text-blue-600">
                    ${stats?.totalPlatformFees?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Performer Payouts:</span>
                  <span className="font-semibold text-green-600">
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
                  <span className="text-gray-600">Platform Fees:</span>
                  <span className="font-semibold text-blue-600">
                    ${platformEarnings?.totalPlatformFees?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Partner (30%):</span>
                  <span className="font-semibold text-orange-600">
                    ${platformEarnings?.totalPaymentPartnerFees?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Net Earnings (70%):</span>
                  <span className="font-semibold text-green-600">
                    ${platformEarnings?.netPlatformEarnings?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button 
                  type="primary" 
                  icon={<PlayCircleOutlined />}
                  onClick={runBatchProcessing}
                  className="w-full"
                >
                  Run Batch Processing
                </Button>
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={loadDashboardData}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
