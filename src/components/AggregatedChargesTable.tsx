import logger from "../utils/logger";
import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Select, DatePicker, Space, Button, message, Statistic, Row, Col } from 'antd';
import { ReloadOutlined, DollarOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { apiService } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface AggregatedCharge {
  id: string;
  paymentMethodId: string;
  stripePaymentIntentId: string;
  aggregatedAmount: number;
  tipCount: number;
  status: string;
  failureReason?: string;
  createdAt: string;
  processedAt?: string;
  batchProcessingRunId?: string;
}

interface AggregatedChargesStats {
  grouped: Array<{
    status: string;
    count: number;
    totalAmount: number;
  }>;
  overall: {
    count: number;
    totalAmount: number;
  };
}

const AggregatedChargesTable: React.FC = () => {
  const [charges, setCharges] = useState<AggregatedCharge[]>([]);
  const [stats, setStats] = useState<AggregatedChargesStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  useEffect(() => {
    loadCharges();
    loadStats();
  }, [currentPage, filterStatus, dateRange]);

  const loadCharges = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (filterStatus) params.append('status', filterStatus);
      if (dateRange?.[0]) params.append('startDate', dateRange[0].toISOString());
      if (dateRange?.[1]) params.append('endDate', dateRange[1].toISOString());

      const response = await apiService.get(`/api/admin/aggregated-charges?${params.toString()}`);
      if (response.data) {
        setCharges(response.data.items);
        setTotalCount(response.data.totalCount);
      }
    } catch (error) {
      logger.error('Error loading aggregated charges:', error);
      message.error('Failed to load aggregated charges');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange?.[0]) params.append('since', dateRange[0].toISOString());

      const response = await apiService.get(`/api/admin/aggregated-charges/stats?${params.toString()}`);
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      succeeded: { color: 'success', icon: <CheckCircleOutlined /> },
      pending: { color: 'processing', icon: <WarningOutlined /> },
      failed: { color: 'error', icon: <CloseCircleOutlined /> },
      manual_review: { color: 'warning', icon: <WarningOutlined /> },
    };

    const config = statusConfig[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {status.toUpperCase().replace('_', ' ')}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
      width: 150,
    },
    {
      title: 'Tips',
      dataIndex: 'tipCount',
      key: 'tipCount',
      align: 'center' as const,
      width: 80,
    },
    {
      title: 'Amount',
      dataIndex: 'aggregatedAmount',
      key: 'aggregatedAmount',
      render: (amount: number) => `$${amount.toFixed(2)}`,
      align: 'right' as const,
      width: 120,
    },
    {
      title: 'Payment Method',
      dataIndex: 'paymentMethodId',
      key: 'paymentMethodId',
      render: (id: string) => (
        <span className="font-mono text-xs">{id.substring(0, 20)}...</span>
      ),
      width: 180,
    },
    {
      title: 'Payment Intent',
      dataIndex: 'stripePaymentIntentId',
      key: 'stripePaymentIntentId',
      render: (id: string) => (
        id ? <span className="font-mono text-xs">{id.substring(0, 20)}...</span> : <span className="text-gray-400">—</span>
      ),
      width: 180,
    },
    {
      title: 'Processed',
      dataIndex: 'processedAt',
      key: 'processedAt',
      render: (date?: string) => (
        date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : <span className="text-gray-400">—</span>
      ),
      width: 180,
    },
    {
      title: 'Failure Reason',
      dataIndex: 'failureReason',
      key: 'failureReason',
      render: (reason?: string) => (
        reason ? (
          <span className="text-red-600 text-xs">{reason}</span>
        ) : (
          <span className="text-gray-400">—</span>
        )
      ),
    },
  ];

  const getStatByStatus = (status: string) => {
    return stats?.grouped.find(g => g.status === status) || { count: 0, totalAmount: 0 };
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {stats && (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Aggregations"
                value={stats.overall.count}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Amount"
                value={stats.overall.totalAmount}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Succeeded"
                value={getStatByStatus('succeeded').count}
                suffix={`($${getStatByStatus('succeeded').totalAmount.toFixed(2)})`}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Manual Review"
                value={getStatByStatus('manual_review').count}
                suffix={`($${getStatByStatus('manual_review').totalAmount.toFixed(2)})`}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card>
        <Space size="middle" wrap>
          <Select
            placeholder="Filter by status"
            style={{ width: 200 }}
            allowClear
            value={filterStatus}
            onChange={(value) => {
              setFilterStatus(value);
              setCurrentPage(1);
            }}
          >
            <Select.Option value="succeeded">Succeeded</Select.Option>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="failed">Failed</Select.Option>
            <Select.Option value="manual_review">Manual Review</Select.Option>
          </Select>

          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates);
              setCurrentPage(1);
            }}
            format="YYYY-MM-DD"
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadCharges();
              loadStats();
            }}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card title="Aggregated Charges">
        <Table
          columns={columns}
          dataSource={charges}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalCount,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} aggregated charges`,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
};

export default AggregatedChargesTable;
