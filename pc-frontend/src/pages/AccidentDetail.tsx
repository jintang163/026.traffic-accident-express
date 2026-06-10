import { Card, Descriptions, Tag, Button, Space, Row, Col, Image, Divider, Result, message, Typography, Modal, Form, Input, InputNumber, Table, Tabs, Timeline } from 'antd';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, FileTextOutlined, EditOutlined, CloudUploadOutlined, HistoryOutlined, PictureOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { getAccidentDetail, determineLiability, generateCertificate, adminOverrideLiability, adminGetEvidence, adminGetAccidentAuditLogs, adminPushToPolice } from '../api';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const AccidentDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [overrideVisible, setOverrideVisible] = useState(false);
  const [overrideForm] = Form.useForm();
  const [evidence, setEvidence] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAccidentDetail(id!);
      setData(res || getMockData());
    } catch { setData(getMockData()); } finally { setLoading(false); }
  };

  const loadEvidence = async () => {
    if (!id) return;
    try {
      const res = await adminGetEvidence(id);
      setEvidence(res.data || null);
    } catch { setEvidence(null); }
  };

  const loadAuditLogs = async () => {
    if (!id) return;
    try {
      const res = await adminGetAccidentAuditLogs(id);
      setAuditLogs(res.data || []);
    } catch { setAuditLogs([]); }
  };

  const getMockData = () => ({
    id: '1', reportNo: 'BA202606080001', accidentType: 'rear_end',
    occurTime: '2026-06-08 10:30:00', location: '北京市朝阳区建国路88号',
    latitude: 39.9087, longitude: 116.4074,
    description: '后车未保持安全车距，追尾前车，造成后车前脸受损，前车后保险杠凹陷。',
    weather: 'sunny', roadCondition: 'dry', status: 'completed',
    createdAt: '2026-06-08 10:32:00',
    vehicles: [
      { id: 'v1', plateNo: '京A12345', plateColor: '蓝色', vehicleType: '小型轿车', ownerName: '张三', ownerPhone: '138****8888', insuranceCompany: '中国平安保险', damage: '后保险杠凹陷，尾灯破裂' },
      { id: 'v2', plateNo: '京B67890', plateColor: '蓝色', vehicleType: '小型轿车', ownerName: '李四', ownerPhone: '139****9999', insuranceCompany: '中国人保财险', damage: '前脸受损，格栅破裂' },
    ],
    scenePhotos: [
      { id: 'p1', url: 'https://via.placeholder.com/300', type: 'scene' },
      { id: 'p2', url: 'https://via.placeholder.com/300', type: 'scene' },
      { id: 'p3', url: 'https://via.placeholder.com/300', type: 'plate' },
    ],
    liabilityResult: {
      primaryParty: '李四（后车）', secondaryParty: '张三（前车）',
      primaryLiability: 100, secondaryLiability: 0,
      liabilityDescription: '后车未保持安全车距，负全部责任',
      determinedAt: '2026-06-08 10:35:00', officer: '系统自动判定',
    },
    certificateId: 'c1',
  });

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待处理' }, processing: { color: 'blue', text: '处理中' },
    completed: { color: 'green', text: '已完成' }, manual_review: { color: 'purple', text: '人工复核' },
  };
  const typeMap: Record<string, string> = {
    rear_end: '追尾事故', side_swipe: '变道刮擦', head_on: '正面碰撞',
    reverse: '倒车事故', intersection: '路口事故', other: '其他事故',
  };
  const weatherMap: Record<string, string> = { sunny: '晴天', rainy: '雨天', cloudy: '阴天', foggy: '雾天', snowy: '雪天' };
  const roadMap: Record<string, string> = { dry: '干燥', wet: '湿滑', icy: '结冰', oily: '油污' };

  const handleDetermineLiability = async () => {
    if (!id) return;
    setActionLoading(true);
    try { await determineLiability(id, { officer: '管理员' }); message.success('责任判定成功'); loadData(); }
    catch { message.error('责任判定失败'); } finally { setActionLoading(false); }
  };

  const handleGenerateCertificate = async () => {
    if (!id) return;
    setActionLoading(true);
    try { await generateCertificate(id); message.success('认定书生成成功'); loadData(); }
    catch { message.error('认定书生成失败'); } finally { setActionLoading(false); }
  };

  const handleOverrideLiability = async () => {
    try {
      const values = await overrideForm.validateFields();
      setActionLoading(true);
      await adminOverrideLiability(id!, values);
      message.success('定责修改成功');
      setOverrideVisible(false);
      overrideForm.resetFields();
      loadData();
      loadAuditLogs();
    } catch (e: any) { if (e.errorFields) return; message.error('修改失败'); } finally { setActionLoading(false); }
  };

  const handlePushToPolice = async () => {
    if (!id) return;
    setActionLoading(true);
    try { await adminPushToPolice(id); message.success('已推送到交警业务系统'); loadAuditLogs(); }
    catch { message.error('推送失败'); } finally { setActionLoading(false); }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'evidence' && !evidence) loadEvidence();
    if (key === 'logs' && auditLogs.length === 0) loadAuditLogs();
  };

  if (!data) return null;
  const status = statusMap[data.status] || statusMap.pending;

  const actionMap: Record<string, string> = {
    override_liability: '修改定责', review_appeal: '审核申诉',
    batch_export_certificates: '批量导出', push_to_police_system: '推送交警系统',
  };

  const logColumns = [
    { title: '操作', dataIndex: 'action', key: 'action', render: (a: string) => <Tag color="blue">{actionMap[a] || a}</Tag> },
    { title: '操作人', dataIndex: 'operatorName', key: 'operatorName' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accidents')}>返回列表</Button>
          <Title level={4} className="page-title" style={{ margin: 0 }}>事故审核</Title>
        </Space>
        <Space>
          <Tag color={status.color} style={{ fontSize: 16, padding: '4px 16px' }}>{status.text}</Tag>
          <span style={{ color: '#999' }}>{data.reportNo}</span>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={handleTabChange} items={[
        { key: 'info', label: '基本信息', children: (
          <div>
            <Card loading={loading} style={{ marginBottom: 16 }}>
              <Title level={5}>基本信息</Title>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="事故编号">{data.reportNo}</Descriptions.Item>
                <Descriptions.Item label="事故类型">{typeMap[data.accidentType]}</Descriptions.Item>
                <Descriptions.Item label="发生时间">{data.occurTime}</Descriptions.Item>
                <Descriptions.Item label="发生地点">{data.location}</Descriptions.Item>
                <Descriptions.Item label="天气">{weatherMap[data.weather]}</Descriptions.Item>
                <Descriptions.Item label="路面情况">{roadMap[data.roadCondition]}</Descriptions.Item>
                <Descriptions.Item label="报案时间" span={2}>{data.createdAt}</Descriptions.Item>
                <Descriptions.Item label="事故描述" span={2}>{data.description}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Card title="涉事车辆" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                {data.vehicles?.map((v: any, i: number) => (
                  <Col span={12} key={v.id}>
                    <Card size="small" type="inner" title={'车辆 ' + (i + 1)} extra={<Tag color={i === 0 ? 'blue' : 'red'}>{i === 0 ? '前车' : '后车'}</Tag>}>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="车牌号">{v.plateNo}</Descriptions.Item>
                        <Descriptions.Item label="号牌颜色">{v.plateColor}</Descriptions.Item>
                        <Descriptions.Item label="车辆类型">{v.vehicleType}</Descriptions.Item>
                        <Descriptions.Item label="车主">{v.ownerName}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{v.ownerPhone}</Descriptions.Item>
                        <Descriptions.Item label="保险公司">{v.insuranceCompany}</Descriptions.Item>
                        <Descriptions.Item label="车辆损失">{v.damage}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
            {data.liabilityResult && (
              <Card title="责任认定" style={{ marginBottom: 16 }} extra={
                <Button icon={<EditOutlined />} onClick={() => setOverrideVisible(true)}>修改定责</Button>
              }>
                <Result status="success" title="责任认定已完成" subTitle={data.liabilityResult.liabilityDescription}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#f53f3f' }}>{data.liabilityResult.primaryLiability}%</div>
                      <div style={{ color: '#666' }}>{data.liabilityResult.primaryParty}</div>
                    </div>
                    <div style={{ fontSize: 20, color: '#999', alignSelf: 'center' }}>VS</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#00b42a' }}>{data.liabilityResult.secondaryLiability}%</div>
                      <div style={{ color: '#666' }}>{data.liabilityResult.secondaryParty}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, color: '#999' }}>认定时间：{data.liabilityResult.determinedAt} | 认定人：{data.liabilityResult.officer}</div>
                </Result>
              </Card>
            )}
            <Card>
              <Space>
                {data.status !== 'completed' && <Button type="primary" loading={actionLoading} onClick={handleDetermineLiability}>责任判定</Button>}
                {data.liabilityResult && !data.certificateId && <Button type="primary" loading={actionLoading} onClick={handleGenerateCertificate}>生成认定书</Button>}
                {data.certificateId && <Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate('/certificates/' + data.certificateId)}>查看认定书</Button>}
                <Button icon={<CloudUploadOutlined />} loading={actionLoading} onClick={handlePushToPolice}>推送交警系统</Button>
              </Space>
            </Card>
          </div>
        )},
        { key: 'evidence', label: '证据审核', icon: <PictureOutlined />, children: (
          <div>
            {evidence?.gpsInfo && (
              <Card title="GPS定位信息" style={{ marginBottom: 16 }}>
                <Descriptions column={3} bordered size="small">
                  <Descriptions.Item label="纬度">{evidence.gpsInfo.latitude}</Descriptions.Item>
                  <Descriptions.Item label="经度">{evidence.gpsInfo.longitude}</Descriptions.Item>
                  <Descriptions.Item label="地址">{evidence.gpsInfo.location}</Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 12, padding: 60, background: '#f5f5f5', borderRadius: 8, textAlign: 'center', color: '#999' }}>
                  <EnvironmentOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                  <div>地图视图（需接入地图API）</div>
                  <div style={{ fontSize: 12 }}>经度: {evidence.gpsInfo.longitude} 纬度: {evidence.gpsInfo.latitude}</div>
                </div>
              </Card>
            )}
            <Card title="现场照片" style={{ marginBottom: 16 }}>
              {evidence?.scenePhotos?.length > 0 ? (
                <Image.PreviewGroup>
                  <Row gutter={[16, 16]}>
                    {evidence.scenePhotos.map((p: any) => (
                      <Col span={6} key={p.id}>
                        <Image width="100%" height={180} src={p.url} style={{ borderRadius: 8, objectFit: 'cover' }} />
                        <div style={{ textAlign: 'center', marginTop: 4, color: '#999', fontSize: 12 }}>{p.type === 'plate' ? '车牌' : p.type === 'damage' ? '受损' : '现场'}</div>
                      </Col>
                    ))}
                  </Row>
                </Image.PreviewGroup>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无现场照片</div>
              )}
            </Card>
            {evidence?.dashcamVideoUrl && (
              <Card title="行车记录仪视频" style={{ marginBottom: 16 }}>
                <video src={evidence.dashcamVideoUrl} controls style={{ width: '100%', maxHeight: 400 }} />
              </Card>
            )}
            {evidence?.vehicles && (
              <Card title="涉事车辆信息">
                <Table dataSource={evidence.vehicles} rowKey="plateNo" pagination={false} size="small"
                  columns={[
                    { title: '车牌号', dataIndex: 'plateNo' }, { title: '车主', dataIndex: 'ownerName' },
                    { title: '联系电话', dataIndex: 'ownerPhone' },
                  ]}
                />
              </Card>
            )}
          </div>
        )},
        { key: 'logs', label: '操作日志', icon: <HistoryOutlined />, children: (
          <Card>
            {auditLogs.length > 0 ? (
              <Table columns={logColumns} dataSource={auditLogs} rowKey="id" pagination={false} size="small" />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无操作日志</div>
            )}
          </Card>
        )},
      ]} />

      <Modal title="修改定责结果" open={overrideVisible} onCancel={() => setOverrideVisible(false)} onOk={handleOverrideLiability} confirmLoading={actionLoading} width={600}>
        <Form form={overrideForm} layout="vertical">
          <Form.Item name="primaryParty" label="主要责任方" rules={[{ required: true, message: '请输入主要责任方' }]}>
            <Input placeholder="如：李四（后车）" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="primaryLiability" label="主要责任比例(%)" rules={[{ required: true, message: '请输入比例' }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="100" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="secondaryLiability" label="次要责任比例(%)" rules={[{ required: true, message: '请输入比例' }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="liabilityDescription" label="责任说明" rules={[{ required: true, message: '请输入责任说明' }]}>
            <TextArea rows={3} placeholder="请输入修改后的责任说明" />
          </Form.Item>
          <Form.Item name="legalBasis" label="法律依据">
            <Input placeholder="如：《道路交通安全法》第XX条" />
          </Form.Item>
          <Form.Item name="reviewComment" label="审核意见">
            <TextArea rows={2} placeholder="请输入审核意见" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AccidentDetail;
