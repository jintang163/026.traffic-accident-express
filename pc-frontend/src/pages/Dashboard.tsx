import { Row, Col, Card, Table, Tag, Typography, Statistic, Progress } from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import {
  CarOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  RobotOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { adminGetDashboardStatistics, adminGetDailyTrend, adminGetTypeDistribution, getAccidentList } from '../api';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({});
  const [trend, setTrend] = useState<any[]>([]);
  const [typeDist, setTypeDist] = useState<any[]>([]);
  const [recentAccidents, setRecentAccidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, trendRes, typeRes, recentRes] = await Promise.all([
        adminGetDashboardStatistics(30).catch(() => null),
        adminGetDailyTrend(30).catch(() => null),
        adminGetTypeDistribution().catch(() => null),
        getAccidentList({ page: 1, pageSize: 10 }).catch(() => ({ list: [] })),
      ]);

      const s = statsRes?.data || {};
      setStats(s);
      setTrend(trendRes?.data || getMockTrend());
      setTypeDist(typeRes?.data || getMockTypeDist());
      setRecentAccidents(recentRes?.list || getMockRecent());
    } catch {
      setStats(getMockStats());
      setTrend(getMockTrend());
      setTypeDist(getMockTypeDist());
      setRecentAccidents(getMockRecent());
    } finally { setLoading(false); }
  };

  const getMockStats = () => ({
    totalAccidents: 128, pendingAccidents: 15, completedAccidents: 98,
    totalAppeals: 12, pendingAppeals: 5, approvedAppeals: 3, rejectedAppeals: 4,
    automationRate: 88, appealRatio: 9,
  });
  const getMockTrend = () => Array.from({ length: 30 }, (_, i) => ({
    date: dayjs().subtract(29 - i, 'day').format('YYYY-MM-DD'),
    accidents: Math.floor(Math.random() * 20) + 5,
    certificates: Math.floor(Math.random() * 18) + 4,
    appeals: Math.floor(Math.random() * 3),
  }));
  const getMockTypeDist = () => [
    { type: 'rear_end', count: 45 }, { type: 'side_swipe', count: 28 },
    { type: 'head_on', count: 20 }, { type: 'reverse', count: 15 }, { type: 'other', count: 20 },
  ];
  const getMockRecent = () => Array.from({ length: 5 }, (_, i) => ({
    id: String(i + 1), reportNo: `BA202606${String(10 - i).padStart(2, '0')}000${i + 1}`,
    accidentType: ['rear_end', 'side_swipe', 'head_on', 'reverse', 'intersection'][i],
    location: ['朝阳区建国路88号', '海淀区中关村大街1号', '西城区西单北大街', '东城区王府井大街', '丰台区南三环西路'][i],
    status: ['completed', 'processing', 'pending', 'completed', 'completed'][i],
    createdAt: `2026-06-${String(10 - i).padStart(2, '0')} ${10 + i}:30:00`,
  }));

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待处理' }, processing: { color: 'blue', text: '处理中' },
    completed: { color: 'green', text: '已完成' }, manual_review: { color: 'purple', text: '人工复核' },
  };
  const typeMap: Record<string, string> = {
    rear_end: '追尾事故', side_swipe: '变道刮擦', head_on: '正面碰撞',
    reverse: '倒车事故', intersection: '路口事故', other: '其他事故',
  };

  const trendChart = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['事故数量', '认定书数量', '申诉数量'] },
    xAxis: { type: 'category', data: trend.map((t: any) => t.date?.slice(5)) },
    yAxis: { type: 'value' },
    series: [
      { name: '事故数量', type: 'bar', data: trend.map((t: any) => t.accidents), itemStyle: { color: '#1E5EFA' } },
      { name: '认定书数量', type: 'line', data: trend.map((t: any) => t.certificates), itemStyle: { color: '#00B42A' } },
      { name: '申诉数量', type: 'line', data: trend.map((t: any) => t.appeals), itemStyle: { color: '#FF7D00' } },
    ],
  };

  const typePie = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      name: '事故类型', type: 'pie', radius: ['40%', '70%'],
      data: typeDist.map((t: any) => ({ value: t.count, name: typeMap[t.type] || t.type })),
    }],
  };

  const columns = [
    { title: '事故编号', dataIndex: 'reportNo', key: 'reportNo' },
    { title: '事故类型', dataIndex: 'accidentType', key: 'accidentType', render: (t: string) => typeMap[t] || t },
    { title: '发生地点', dataIndex: 'location', key: 'location', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => { const st = statusMap[s] || statusMap.pending; return <Tag color={st.color}>{st.text}</Tag>; } },
    { title: '报案时间', dataIndex: 'createdAt', key: 'createdAt' },
    { title: '操作', key: 'action', render: (_: any, r: any) => <a onClick={() => navigate(`/accidents/${r.id}`)}>详情</a> },
  ];

  return (
    <div>
      <div className="page-header"><Title level={4} className="page-title">统计仪表盘</Title></div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card><Statistic title="事故总数" value={stats.totalAccidents || 0} prefix={<CarOutlined />} valueStyle={{ color: '#1E5EFA' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="待处理" value={stats.pendingAccidents || 0} valueStyle={{ color: '#FF7D00' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="认定书总数" value={stats.completedAccidents || 0} prefix={<SafetyCertificateOutlined />} valueStyle={{ color: '#00B42A' }} /></Card>
        </Col>
        <Col span={4}>
          <Card><Statistic title="申诉总数" value={stats.totalAppeals || 0} prefix={<AuditOutlined />} valueStyle={{ color: '#F53F3F' }} /></Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="定责自动化率" value={stats.automationRate || 0} suffix="%" prefix={<RobotOutlined />} valueStyle={{ color: '#722ED1' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="申诉占比" value={stats.appealRatio || 0} suffix="%" prefix={<AlertOutlined />} valueStyle={{ color: '#0FC6C2' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <Card title="近30天数据趋势">
            <ReactECharts option={trendChart} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="事故类型分布">
            <ReactECharts option={typePie} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Card title="最近报案" extra={<a onClick={() => navigate('/accidents')}>查看全部</a>}>
        <Table columns={columns} dataSource={recentAccidents} rowKey="id" loading={loading} pagination={false} size="small" />
      </Card>
    </div>
  );
};

export default Dashboard;
