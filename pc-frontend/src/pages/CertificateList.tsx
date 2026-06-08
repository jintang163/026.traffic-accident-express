import { Table, Tag, Button, Space, Input, Select, DatePicker, Card } from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getCertificateList } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const CertificateList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<any>({});

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCertificateList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      });
      setData(res.list || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch (error) {
      console.error('Load certificate list failed:', error);
      setData(getMockData());
      setPagination((prev) => ({ ...prev, total: 20 }));
    } finally {
      setLoading(false);
    }
  };

  const getMockData = () => {
    const statuses = ['confirmed', 'pending', 'revoked'];
    return Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      certificateNumber: `RD2026060${8 - Math.floor(i / 3)}000${i + 1}`,
      accidentNumber: `SG2026060${8 - Math.floor(i / 3)}000${i + 1}`,
      accidentType: i % 2 === 0 ? '追尾事故' : '变道刮擦',
      partyA: `张三 · 京A${10000 + i}`,
      partyB: `李四 · 京B${20000 + i}`,
      status: statuses[i % statuses.length],
      createdAt: `2026-06-0${8 - Math.floor(i / 3)} 10:${30 + i * 5}`,
      verifyCode: `A${i}B${i + 1}C${i + 2}`,
    }));
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待确认' },
    confirmed: { color: 'green', text: '已确认' },
    revoked: { color: 'red', text: '已撤销' },
  };

  const columns = [
    { title: '认定书编号', dataIndex: 'certificateNumber', key: 'certificateNumber', width: 200 },
    { title: '事故编号', dataIndex: 'accidentNumber', key: 'accidentNumber', width: 180 },
    { title: '事故类型', dataIndex: 'accidentType', key: 'accidentType', width: 120 },
    { title: '甲方', dataIndex: 'partyA', key: 'partyA', width: 200 },
    { title: '乙方', dataIndex: 'partyB', key: 'partyB', width: 200 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const s = statusMap[status] || statusMap.pending;
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '生成时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '核验码',
      dataIndex: 'verifyCode',
      key: 'verifyCode',
      width: 120,
      render: (code: string) => <span style={{ fontFamily: 'monospace' }}>{code}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => navigate(`/certificates/${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 });
    loadData();
  };

  const handleReset = () => {
    setFilters({});
    setPagination((prev) => ({ ...prev, current: 1 }));
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">认定书管理</h2>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={16}>
          <Input
            placeholder="搜索认定书编号"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={filters.status}
            onChange={(val) => setFilters({ ...filters, status: val })}
          >
            {Object.entries(statusMap).map(([key, val]) => (
              <Option key={key} value={key}>{val.text}</Option>
            ))}
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
        />
      </Card>
    </div>
  );
};

export default CertificateList;
