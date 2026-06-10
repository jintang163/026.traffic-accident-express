import { Table, Tag, Button, Space, Input, Select, DatePicker, Card, Modal, message, Dropdown } from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, CloudUploadOutlined, MoreOutlined } from '@ant-design/icons';
import { adminGetAccidentList, adminBatchExportCertificates, adminPushToPolice } from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AccidentList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<any>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [pagination.current, pagination.pageSize]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminGetAccidentList({
        page: pagination.current, pageSize: pagination.pageSize, ...filters,
      });
      setData(res.list || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch {
      setData(getMockData());
      setPagination((prev) => ({ ...prev, total: 25 }));
    } finally { setLoading(false); }
  };

  const getMockData = () => {
    const types = ['rear_end', 'side_swipe', 'head_on', 'reverse', 'intersection'];
    const statuses = ['pending', 'processing', 'completed', 'manual_review'];
    const locations = ['朝阳区建国路88号', '海淀区中关村大街1号', '西城区西单北大街', '东城区王府井大街', '丰台区南三环西路'];
    return Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1), reportNo: `BA202606${String(10 - Math.floor(i / 3)).padStart(2, '0')}000${i + 1}`,
      accidentType: types[i % types.length], location: locations[i % locations.length],
      status: statuses[i % statuses.length],
      createdAt: `2026-06-${String(10 - Math.floor(i / 3)).padStart(2, '0')} ${10 + i}:${30 + i * 5}:00`,
      vehicles: [{ plateNo: `京A${10000 + i}` }, { plateNo: `京B${20000 + i}` }],
    }));
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待处理' }, processing: { color: 'blue', text: '处理中' },
    completed: { color: 'green', text: '已完成' }, manual_review: { color: 'purple', text: '人工复核' },
  };
  const typeMap: Record<string, string> = {
    rear_end: '追尾事故', side_swipe: '变道刮擦', head_on: '正面碰撞',
    reverse: '倒车事故', intersection: '路口事故', other: '其他事故',
  };

  const columns = [
    { title: '事故编号', dataIndex: 'reportNo', key: 'reportNo', width: 180 },
    { title: '事故类型', dataIndex: 'accidentType', key: 'accidentType', width: 120, render: (t: string) => typeMap[t] || t },
    { title: '发生地点', dataIndex: 'location', key: 'location', ellipsis: true },
    { title: '涉事车辆', dataIndex: 'vehicles', key: 'vehicles', width: 200, render: (v: any[]) => v?.map((item) => item.plateNo).join(' / ') },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => { const st = statusMap[s] || statusMap.pending; return <Tag color={st.color}>{st.text}</Tag>; } },
    { title: '报案时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    { title: '操作', key: 'action', width: 160, fixed: 'right' as const, render: (_: any, r: any) => (
      <Space>
        <Button type="link" onClick={() => navigate('/accidents/' + r.id)}>审核</Button>
        <Dropdown menu={{ items: [
          { key: 'push', label: '推送交警系统', onClick: () => handlePushSingle(r.id) },
          { key: 'export', label: '导出认定书', onClick: () => handleExportSingle(r.id) },
        ]}}>
          <Button type="link" icon={<MoreOutlined />} />
        </Dropdown>
      </Space>
    )},
  ];

  const handleSearch = () => { setPagination((prev) => ({ ...prev, current: 1 })); loadData(); };
  const handleReset = () => { setFilters({}); setPagination((prev) => ({ ...prev, current: 1 })); loadData(); };

  const handleBatchExport = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请选择要导出的记录'); return; }
    try {
      const res = await adminBatchExportCertificates(selectedRowKeys);
      const results = res.data || [];
      const success = results.filter((r: any) => !r.error).length;
      message.success(`成功导出 ${success} 份认定书`);
      setSelectedRowKeys([]);
    } catch { message.error('批量导出失败'); }
  };

  const handleExportSingle = async (id: string) => {
    try {
      const res = await adminBatchExportCertificates([id]);
      const result = res.data?.[0];
      if (result?.pdfUrl) { message.success('导出成功'); window.open(result.pdfUrl, '_blank'); }
      else { message.warning('认定书尚未生成'); }
    } catch { message.error('导出失败'); }
  };

  const handlePushSingle = async (id: string) => {
    try { await adminPushToPolice(id); message.success('推送成功'); }
    catch { message.error('推送失败'); }
  };

  return (
    <div>
      <div className="page-header"><h2 className="page-title">事故审核</h2></div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={16}>
          <Input placeholder="搜索事故编号/车牌号" prefix={<SearchOutlined />} style={{ width: 220 }}
            value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} onPressEnter={handleSearch} />
          <Select placeholder="事故类型" style={{ width: 150 }} allowClear value={filters.accidentType}
            onChange={(v) => setFilters({ ...filters, accidentType: v })}>
            {Object.entries(typeMap).map(([k, l]) => <Option key={k} value={k}>{l}</Option>)}
          </Select>
          <Select placeholder="状态" style={{ width: 130 }} allowClear value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}>
            {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Select placeholder="地区" style={{ width: 150 }} allowClear value={filters.region}
            onChange={(v) => setFilters({ ...filters, region: v })}>
            <Option value="chaoyang">朝阳区</Option><Option value="haidian">海淀区</Option>
            <Option value="xicheng">西城区</Option><Option value="dongcheng">东城区</Option>
            <Option value="fengtai">丰台区</Option>
          </Select>
          <RangePicker value={filters.dateRange} onChange={(d) => setFilters({ ...filters, dateRange: d })} />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Card>
      <Card extra={
        <Space>
          <Button icon={<DownloadOutlined />} disabled={selectedRowKeys.length === 0} onClick={handleBatchExport}>
            批量导出 ({selectedRowKeys.length})
          </Button>
        </Space>
      }>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1100 }}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
          pagination={{
            ...pagination, showSizeChanger: true, showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
        />
      </Card>
    </div>
  );
};

export default AccidentList;
