import { Table, Tag, Button, Space, Input, Select, DatePicker, Card } from 'antd';
import { useState, useEffect } from 'react';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAuditLogList } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const actionMap: Record<string, { color: string; text: string }> = {
  override_liability: { color: 'orange', text: '修改定责' },
  review_appeal: { color: 'blue', text: '审核申诉' },
  batch_export_certificates: { color: 'green', text: '批量导出' },
  push_to_police_system: { color: 'purple', text: '推送交警系统' },
};

const truncateJson = (value: any, maxLen = 80) => {
  if (value === null || value === undefined) return '-';
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
};

const AuditLog: React.FC = () => {
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
      const params: any = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        action: filters.action,
        operatorName: filters.operatorName,
      };
      if (filters.dateRange?.[0]) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
      }
      if (filters.dateRange?.[1]) {
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }
      const res = await getAuditLogList(params);
      setData(res.list || res.data || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch (error) {
      console.error('Load audit log list failed:', error);
      setData(getMockData());
      setPagination((prev) => ({ ...prev, total: 25 }));
    } finally {
      setLoading(false);
    }
  };

  const getMockData = () => {
    const actions = Object.keys(actionMap);
    const operators = ['张三', '李四', '王五', '赵六'];
    const descriptions = [
      '修改了事故SG20260601001的定责结果',
      '审核通过了申诉AP20260601001',
      '批量导出了5份事故认定书',
      '推送事故SG20260601002至交警系统',
      '修改了事故SG20260602003的责任比例',
      '驳回了申诉AP20260602002',
    ];
    return Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      action: actions[i % actions.length],
      operatorName: operators[i % operators.length],
      description: descriptions[i % descriptions.length],
      beforeValue: { liability: '对方全责', ratio: '100:0' },
      afterValue: { liability: '主次责任', ratio: '70:30' },
      createdAt: `2026-06-0${8 - Math.floor(i / 3)} ${10 + i}:${30 + i * 5}:00`,
    }));
  };

  const columns = [
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (action: string) => {
        const m = actionMap[action];
        return m ? <Tag color={m.color}>{m.text}</Tag> : action;
      },
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 120,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: '变更前',
      dataIndex: 'beforeValue',
      key: 'beforeValue',
      width: 160,
      render: (val: any) => truncateJson(val),
    },
    {
      title: '变更后',
      dataIndex: 'afterValue',
      key: 'afterValue',
      width: 160,
      render: (val: any) => truncateJson(val),
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
    },
  ];

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    loadData();
  };

  const handleReset = () => {
    setFilters({});
    setPagination((prev) => ({ ...prev, current: 1 }));
    setTimeout(() => loadData(), 0);
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">操作审计日志</h2>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={16}>
          <Select
            placeholder="操作类型"
            style={{ width: 150 }}
            allowClear
            value={filters.action}
            onChange={(val) => setFilters({ ...filters, action: val })}
          >
            {Object.entries(actionMap).map(([key, val]) => (
              <Option key={key} value={key}>{val.text}</Option>
            ))}
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
          />
          <Input
            placeholder="操作人姓名"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.operatorName}
            onChange={(e) => setFilters({ ...filters, operatorName: e.target.value })}
            onPressEnter={handleSearch}
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
          expandable={{
            expandedRowRender: (record: any) => (
              <div style={{ display: 'flex', gap: 32 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>变更前值：</div>
                  <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, margin: 0, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                    {record.beforeValue ? JSON.stringify(record.beforeValue, null, 2) : '-'}
                  </pre>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>变更后值：</div>
                  <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, margin: 0, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                    {record.afterValue ? JSON.stringify(record.afterValue, null, 2) : '-'}
                  </pre>
                </div>
              </div>
            ),
          }}
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

export default AuditLog;
