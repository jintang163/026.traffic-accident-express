import { Table, Tag, Button, Space, Input, Select, DatePicker, Card } from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAccidentList } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AccidentList: React.FC = () => {
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
      const res = await getAccidentList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      });
      setData(res.list || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch (error) {
      console.error('Load accident list failed:', error);
      setData(getMockData());
      setPagination((prev) => ({ ...prev, total: 25 }));
    } finally {
      setLoading(false);
    }
  };

  const getMockData = () => {
    const types = ['rear_end', 'side_swipe', 'head_on', 'reverse', 'intersection'];
    const statuses = ['pending', 'processing', 'completed'];
    const locations = ['朝阳区建国路88号', '海淀区中关村大街1号', '西城区西单北大街', '东城区王府井大街', '丰台区南三环西路'];
    
    return Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      reportNo: `SG2026060${8 - Math.floor(i / 3)}000${i + 1}`,
      accidentType: types[i % types.length],
      location: locations[i % locations.length],
      status: statuses[i % statuses.length],
      createdAt: `2026-06-0${8 - Math.floor(i / 3)} ${10 + i}:${30 + i * 5}:00`,
      vehicles: [
        { plateNo: `京A${10000 + i}` },
        { plateNo: `京B${20000 + i}` },
      ],
    }));
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待处理' },
    processing: { color: 'blue', text: '处理中' },
    completed: { color: 'green', text: '已完成' },
    cancelled: { color: 'default', text: '已取消' },
  };

  const typeMap: Record<string, string> = {
    rear_end: '追尾事故',
    side_swipe: '变道刮擦',
    head_on: '正面碰撞',
    reverse: '倒车事故',
    intersection: '路口事故',
    other: '其他事故',
  };

  const columns = [
    { title: '事故编号', dataIndex: 'reportNo', key: 'reportNo', width: 180 },
    {
      title: '事故类型',
      dataIndex: 'accidentType',
      key: 'accidentType',
      width: 120,
      render: (type: string) => typeMap[type] || type,
    },
    { title: '发生地点', dataIndex: 'location', key: 'location', ellipsis: true },
    {
      title: '涉事车辆',
      dataIndex: 'vehicles',
      key: 'vehicles',
      width: 200,
      render: (vehicles: any[]) => vehicles?.map((v) => v.plateNo).join(' / '),
    },
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
    { title: '报案时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/accidents/${record.id}`)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
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
        <h2 className="page-title">事故管理</h2>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={16}>
          <Input
            placeholder="搜索事故编号"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="事故类型"
            style={{ width: 150 }}
            allowClear
            value={filters.accidentType}
            onChange={(val) => setFilters({ ...filters, accidentType: val })}
          >
            {Object.entries(typeMap).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
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
          scroll={{ x: 1000 }}
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

export default AccidentList;
