import logger from "../utils/logger";
import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Space, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Card, StatCard, StatusChip, useFeedback, type ChipKind } from './ui';
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
  const { toast: showError } = useFeedback();
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
      showError('Failed to load aggregated charges', 'error');
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
    const config: Record<string, { kind: ChipKind; label: string }> = {
      succeeded: { kind: 'paid', label: 'Succeeded' },
      pending: { kind: 'processing', label: 'Pending' },
      failed: { kind: 'failed', label: 'Failed' },
      manual_review: { kind: 'info', label: 'Needs review' },
    };
    const c = config[status] || { kind: 'offline' as ChipKind, label: status.replace('_', ' ') };
    return <StatusChip kind={c.kind} label={c.label} />;
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
      title: 'Card',
      dataIndex: 'paymentMethodId',
      key: 'paymentMethodId',
      render: (id: string) => (
        <span className="font-mono text-xs">{id.substring(0, 20)}...</span>
      ),
      width: 180,
    },
    {
      title: 'Stripe charge',
      dataIndex: 'stripePaymentIntentId',
      key: 'stripePaymentIntentId',
      render: (id: string) => (
        id ? <span className="font-mono text-xs">{id.substring(0, 20)}...</span> : <span className="text-ink-400">—</span>
      ),
      width: 180,
    },
    {
      title: 'Processed',
      dataIndex: 'processedAt',
      key: 'processedAt',
      render: (date?: string) => (
        date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : <span className="text-ink-400">—</span>
      ),
      width: 180,
    },
    {
      title: 'Failure Reason',
      dataIndex: 'failureReason',
      key: 'failureReason',
      render: (reason?: string) => (
        reason ? (
          <span className="text-xs text-red-700">{reason}</span>
        ) : (
          <span className="text-ink-400">—</span>
        )
      ),
    },
  ];

  const getStatByStatus = (status: string) => {
    return stats?.grouped.find(g => g.status === status) || { count: 0, totalAmount: 0 };
  };

  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const succeeded = getStatByStatus('succeeded');
  const review = getStatByStatus('manual_review');
  const failed = getStatByStatus('failed');

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">
        When one card tips more than once in a batch, the tips are combined into a single charge. Each row below is one combined charge.
      </p>

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard variant="inline" icon="card" label="All charges" value={stats.overall.count.toLocaleString()} caption={`${money(stats.overall.totalAmount)} in total`} />
          <StatCard variant="inline" icon="check-circle" label="Succeeded" value={succeeded.count.toLocaleString()} caption={money(succeeded.totalAmount)} />
          <StatCard variant="inline" icon="warning" label="Needs review" value={review.count.toLocaleString()} caption={money(review.totalAmount)} />
          <StatCard variant="inline" icon="error" label="Failed" value={failed.count.toLocaleString()} caption={money(failed.totalAmount)} />
        </div>
      )}

      <Card>
        <Space size="middle" wrap>
          <Select
            placeholder="All statuses"
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
            <Select.Option value="manual_review">Needs review</Select.Option>
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

      <Card flush>
        <div className="px-2 pb-2">
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
              showTotal: (total) => `${total} charges`,
            }}
            scroll={{ x: 1400 }}
          />
        </div>
      </Card>
    </div>
  );
};

export default AggregatedChargesTable;
