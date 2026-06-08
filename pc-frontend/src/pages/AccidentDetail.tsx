import { Card, Descriptions, Tag, Button, Space, Row, Col, Image, Divider, Result, message, Typography } from 'antd';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { getAccidentDetail, determineLiability, generateCertificate } from '../api';

const { Title, Paragraph } = Typography;

const AccidentDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAccidentDetail(id!);
      setData(res || getMockData());
    } catch (error) {
      console.error('Load accident detail failed:', error);
      setData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const getMockData = () => ({
    id: '1',
    reportNo: 'SG202606080001',
    accidentType: 'rear_end',
    occurTime: '2026-06-08 10:30:00',
    location: '北京市朝阳区建国路88号',
    latitude: 39.9087,
    longitude: 116.4074,
    description: '后车未保持安全车距，追尾前车，造成后车前脸受损，前车后保险杠凹陷。',
    weather: 'sunny',
    roadCondition: 'dry',
    status: 'completed',
    createdAt: '2026-06-08 10:32:00',
    vehicles: [
      {
      id: 'v1',
      plateNo: '京A12345',
      plateColor: '蓝色',
      vehicleType: '小型轿车',
      ownerName: '张三',
      ownerPhone: '138****8888',
      insuranceCompany: '中国平安保险',
      damage: '后保险杠凹陷，尾灯破裂',
    },
    {
      id: 'v2',
      plateNo: '京B67890',
      plateColor: '蓝色',
      vehicleType: '小型轿车',
      ownerName: '李四',
      ownerPhone: '139****9999',
      insuranceCompany: '中国人保财险',
      damage: '前脸受损，格栅破裂',
    },
    ],
    scenePhotos: [
      { id: 'p1', url: 'https://via.placeholder.com/300', type: 'scene' },
      { id: 'p2', url: 'https://via.placeholder.com/300', type: 'scene' },
      { id: 'p3', url: 'https://via.placeholder.com/300', type: 'plate' },
    ],
    liabilityResult: {
      primaryParty: '李四（后车）',
      secondaryParty: '张三（前车）',
      primaryLiability: 100,
      secondaryLiability: 0,
      liabilityDescription: '后车未保持安全车距，负全部责任',
      determinedAt: '2026-06-08 10:35:00',
      officer: '系统自动判定',
    },
    certificateId: 'c1',
  });

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

  const weatherMap: Record<string, string> = {
    sunny: '晴天',
    rainy: '雨天',
    cloudy: '阴天',
    foggy: '雾天',
    snowy: '雪天',
  };

  const roadMap: Record<string, string> = {
    dry: '干燥',
    wet: '湿滑',
    icy: '结冰',
    oily: '油污',
  };

  const handleDetermineLiability = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await determineLiability(id, { officer: '管理员' });
      message.success('责任判定成功');
      loadData();
    } catch (error) {
      message.error('责任判定失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await generateCertificate(id);
      message.success('认定书生成成功');
      loadData();
    } catch (error) {
      message.error('认定书生成失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (!data) return null;

  const status = statusMap[data.status] || statusMap.pending;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accidents')}>
            返回列表
          </Button>
          <Title level={4} className="page-title" style={{ margin: 0 }}>事故详情</Title>
        </Space>
        <Tag color={status.color} style={{ fontSize: 16, padding: '4px 16px' }}>
          {status.text}
        </Tag>
      </div>

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
          {data.vehicles?.map((vehicle: any, index: number) => (
            <Col span={12} key={vehicle.id}>
              <Card
                size="small"
                type="inner"
                title={`车辆 ${index + 1}`}
                extra={<Tag color={index === 0 ? 'blue' : 'red'}>{index === 0 ? '前车' : '后车'}</Tag>}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="车牌号">{vehicle.plateNo}</Descriptions.Item>
                  <Descriptions.Item label="号牌颜色">{vehicle.plateColor}</Descriptions.Item>
                  <Descriptions.Item label="车辆类型">{vehicle.vehicleType}</Descriptions.Item>
                  <Descriptions.Item label="车主">{vehicle.ownerName}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{vehicle.ownerPhone}</Descriptions.Item>
                  <Descriptions.Item label="保险公司">{vehicle.insuranceCompany}</Descriptions.Item>
                  <Descriptions.Item label="车辆损失">{vehicle.damage}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="现场照片" style={{ marginBottom: 16 }}>
        <Image.PreviewGroup>
          <Row gutter={[16, 16]}>
            {data.scenePhotos?.map((photo: any) => (
              <Col span={8} key={photo.id}>
                <Image width="100%" height={200} src={photo.url} />
                <div style={{ textAlign: 'center', marginTop: 8, color: '#999' }}>
                  {photo.type === 'plate' ? '车牌照片' : '现场照片'}
                </div>
              </Col>
            ))}
          </Row>
        </Image.PreviewGroup>
      </Card>

      {data.liabilityResult && (
        <Card title="责任认定" style={{ marginBottom: 16 }}>
          <Result
            status="success"
            title="责任认定已完成"
            subTitle={data.liabilityResult.liabilityDescription}
          >
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f53f3f' }}>
                  {data.liabilityResult.primaryLiability}%
                </div>
                <div style={{ color: '#666' }}>{data.liabilityResult.primaryParty}</div>
              </div>
              <div style={{ fontSize: 20, color: '#999', alignSelf: 'center' }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#00b42a' }}>
                  {data.liabilityResult.secondaryLiability}%
                </div>
                <div style={{ color: '#666' }}>{data.liabilityResult.secondaryParty}</div>
              </div>
            </div>
            <div style={{ marginTop: 16, color: '#999' }}>
              认定时间：{data.liabilityResult.determinedAt} | 认定人：{data.liabilityResult.officer}
            </div>
          </Result>
        </Card>
      )}

      <Card>
        <Space>
          {data.status !== 'completed' && (
            <Button type="primary" loading={actionLoading} onClick={handleDetermineLiability}>
              责任判定
            </Button>
          )}
          {data.liabilityResult && !data.certificateId && (
            <Button type="primary" loading={actionLoading} onClick={handleGenerateCertificate}>
              生成认定书
            </Button>
          )}
          {data.certificateId && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/certificates/${data.certificateId}`)}
            >
              查看认定书
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default AccidentDetail;
