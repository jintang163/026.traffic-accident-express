import { Card, Descriptions, Button, Space, Row, Col, Tag, Divider, Typography, Image } from 'antd';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, PrinterOutlined, DownloadOutlined, ShareAltOutlined, SafetyCertificateOutlined, ReloadOutlined } from '@ant-design/icons';
import { getCertificateDetail, verifyCertificate } from '../api';

const { Title, Paragraph } = Typography;

const CertificateDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCertificateDetail(id!);
      setData(res || getMockData());
    } catch (error) {
      console.error('Load certificate detail failed:', error);
      setData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const getMockData = () => ({
    id: 'c1',
    certificateNumber: 'RD202606080001',
    accidentNumber: 'SG202606080001',
    accidentType: '追尾事故',
    accidentTime: '2026-06-08 10:30:00',
    location: '北京市朝阳区建国路88号',
    status: 'confirmed',
    createdAt: '2026-06-08 10:40:00',
    verifyCode: 'A1B2C3D4E5',
    pdfUrl: '',
    qrCodeUrl: '',
    signatureInfo: {
      provider: 'mock',
      sealType: 'police',
      sealSn: 'SEAL1749000000000',
      signedAt: '2026-06-08T10:40:00.000Z',
      certificateSn: 'CERT1234567890ABCDEF',
      isValid: true,
    },
    partyA: {
      name: '张三',
      idNumber: '110***********1234',
      phone: '138****8888',
      plateNumber: '京A12345',
      vehicleType: '小型轿车',
      insurance: '中国平安保险',
      responsibility: '无责任',
    },
    partyB: {
      name: '李四',
      idNumber: '110***********5678',
      phone: '139****9999',
      plateNumber: '京B67890',
      vehicleType: '小型轿车',
      insurance: '中国人保财险',
      responsibility: '全部责任',
    },
    accidentFacts: '2026年06月08日10时30分，李四驾驶京B67890号小型轿车，在北京市朝阳区建国路88号，由东向西行驶时，未与前车保持安全车距，该车前部与前方同向行驶的张三驾驶的京A12345号小型轿车后部相撞，造成两车损坏。',
    liabilityConclusion: '根据《中华人民共和国道路交通安全法》第四十三条第一款第一项规定，当事人李四负此事故全部责任，当事人张三无责任。',
    legalBasis: '《中华人民共和国道路交通安全法》第四十三条：同车道行驶的机动车，后车应当与前车保持足以采取紧急制动措施的安全距离。',
    policeOfficer: '王警官',
    policeBadge: '110123',
    department: '北京市公安局公安交通管理局朝阳交通支队',
    sealText: '北京市公安局公安交通管理局',
    remarks: [
      '本认定书与纸质认定书具有同等法律效力',
      '当事人对认定有异议的，可在送达之日起三日内申请复核',
      '本认定书可通过核验码或扫描二维码进行核验真伪',
    ],
  });

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待确认' },
    confirmed: { color: 'green', text: '已确认' },
    revoked: { color: 'red', text: '已撤销' },
  };

  const handleVerify = async () => {
    if (!data?.certificateNumber) return;
    try {
      const res = await verifyCertificate(data.certificateNumber);
      setVerifyResult(res);
    } catch (error) {
      setVerifyResult({ valid: false, message: '核验失败' });
    }
  };

  const handleDownloadPdf = () => {
    if (data?.pdfUrl) {
      window.open(data.pdfUrl, '_blank');
    } else if (id) {
      const baseUrl = window.location.origin;
      window.open(baseUrl + '/api/certificate/' + id + '/pdf', '_blank');
    }
  };

  const handlePrint = () => {
    if (id) {
      const baseUrl = window.location.origin;
      window.open(baseUrl + '/api/certificate/' + id + '/pdf', '_blank');
    }
  };

  const handleRegeneratePdf = async () => {
    if (!id) return;
    try {
      const baseUrl = window.location.origin;
      const response = await fetch(baseUrl + '/api/certificate/' + id + '/regenerate-pdf', { method: 'POST' });
      const result = await response.json();
      if (result.success && result.data) {
        setData({ ...data, ...result.data });
      }
    } catch (error) {
      console.error('Regenerate PDF failed:', error);
    }
  };

  if (!data) return null;

  const status = statusMap[data.status] || statusMap.pending;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/certificates')}>
            返回列表
          </Button>
          <Title level={4} className="page-title" style={{ margin: 0 }}>认定书详情</Title>
        </Space>
        <Tag color={status.color} style={{ fontSize: 16, padding: '4px 16px' }}>
          {status.text}
        </Tag>
      </div>

      <Card loading={loading}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #C41E3A', paddingBottom: 20, marginBottom: 20 }}>
          <Title level={3} style={{ color: '#C41E3A', margin: 0 }}>
            道路交通事故认定书
          </Title>
          <div style={{ color: '#999', marginTop: 8 }}>
            {data.certificateNumber}
          </div>
        </div>

        <Title level={5}>事故信息</Title>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 20 }}>
          <Descriptions.Item label="事故编号">{data.accidentNumber}</Descriptions.Item>
          <Descriptions.Item label="事故类型">{data.accidentType}</Descriptions.Item>
          <Descriptions.Item label="发生时间">{data.accidentTime}</Descriptions.Item>
          <Descriptions.Item label="发生地点">{data.location}</Descriptions.Item>
          <Descriptions.Item label="生成时间" span={2}>{data.createdAt}</Descriptions.Item>
        </Descriptions>

        <Title level={5}>当事人信息</Title>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Card size="small" type="inner" title="甲方" extra={<Tag color="blue">无责任</Tag>}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="姓名">{data.partyA.name}</Descriptions.Item>
                <Descriptions.Item label="驾驶证号">{data.partyA.idNumber}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{data.partyA.phone}</Descriptions.Item>
                <Descriptions.Item label="车牌号码">{data.partyA.plateNumber}</Descriptions.Item>
                <Descriptions.Item label="车辆类型">{data.partyA.vehicleType}</Descriptions.Item>
                <Descriptions.Item label="保险公司">{data.partyA.insurance}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" type="inner" title="乙方" extra={<Tag color="red">全部责任</Tag>}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="姓名">{data.partyB.name}</Descriptions.Item>
                <Descriptions.Item label="驾驶证号">{data.partyB.idNumber}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{data.partyB.phone}</Descriptions.Item>
                <Descriptions.Item label="车牌号码">{data.partyB.plateNumber}</Descriptions.Item>
                <Descriptions.Item label="车辆类型">{data.partyB.vehicleType}</Descriptions.Item>
                <Descriptions.Item label="保险公司">{data.partyB.insurance}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Title level={5}>事故事实</Title>
        <Card size="small" style={{ marginBottom: 20, background: '#f5f5f5' }}>
          <Paragraph style={{ margin: 0, lineHeight: 1.8 }}>{data.accidentFacts}</Paragraph>
        </Card>

        <Title level={5}>责任认定及依据</Title>
        <Card size="small" style={{ marginBottom: 20, background: '#fff7e6' }}>
          <Paragraph strong style={{ marginBottom: 16 }}>
            <strong>认定结论：</strong>{data.liabilityConclusion}
          </Paragraph>
          <Paragraph style={{ margin: 0 }}>
            <strong>法律依据：</strong>{data.legalBasis}
          </Paragraph>
        </Card>

        <Title level={5}>办案民警</Title>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 20 }}>
          <Descriptions.Item label="民警姓名">{data.policeOfficer}</Descriptions.Item>
          <Descriptions.Item label="警号">{data.policeBadge}</Descriptions.Item>
          <Descriptions.Item label="办案单位" span={2}>{data.department}</Descriptions.Item>
        </Descriptions>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <div style={{ display: 'inline-block', border: '3px solid #C41E3A', borderRadius: '50%', width: 150, height: 150, lineHeight: '140px', color: '#C41E3A', fontSize: 14, fontWeight: 'bold', opacity: 0.8 }}>
            {data.sealText}
          </div>
          <div style={{ marginTop: 16, color: '#999' }}>
            （电子印章）
          </div>
        </div>

        <div style={{ marginTop: 20, padding: 16, background: '#f0f9ff', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#666', marginBottom: 4 }}>核验码</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e5efa', fontFamily: 'monospace', letterSpacing: 4 }}>
                {data.verifyCode}
              </div>
            </div>
            <Space>
              <Button onClick={handleVerify}>核验真伪</Button>
              {verifyResult && (
                <Tag color={verifyResult.valid ? 'green' : 'red'}>
                  {verifyResult.valid ? '核验通过' : verifyResult.message}
                </Tag>
              )}
            </Space>
          </div>
          {data.qrCodeUrl && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Image src={data.qrCodeUrl} width={150} height={150} alt="核验二维码" />
              <div style={{ color: '#999', marginTop: 4, fontSize: 12 }}>扫描二维码核验真伪</div>
            </div>
          )}
        </div>

        {data.signatureInfo && (
          <>
            <Divider />
            <Title level={5}><SafetyCertificateOutlined style={{ marginRight: 8 }} />电子签章信息</Title>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="签章服务商">{data.signatureInfo.provider}</Descriptions.Item>
              <Descriptions.Item label="印章类型">{data.signatureInfo.sealType === 'police' ? '交警部门印章' : '平台印章'}</Descriptions.Item>
              <Descriptions.Item label="印章序列号">{data.signatureInfo.sealSn}</Descriptions.Item>
              <Descriptions.Item label="证书序列号">{data.signatureInfo.certificateSn}</Descriptions.Item>
              <Descriptions.Item label="签章时间" span={2}>{data.signatureInfo.signedAt}</Descriptions.Item>
            </Descriptions>
          </>
        )}

        <Divider />

        <Title level={5}>备注说明</Title>
        <ul style={{ paddingLeft: 20 }}>
          {data.remarks?.map((remark: string, index: number) => (
            <li key={index} style={{ marginBottom: 8, color: '#666' }}>
              {remark}
            </li>
          ))}
        </ul>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadPdf}>下载PDF</Button>
          <Button icon={<ShareAltOutlined />}>分享</Button>
          <Button icon={<ReloadOutlined />} onClick={handleRegeneratePdf}>重新生成PDF</Button>
        </div>
      </Card>
    </div>
  );
};

export default CertificateDetail;
