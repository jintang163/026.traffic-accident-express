import { Card, Result, Descriptions, Button, Input, Space, Spin, Tag, Row, Col, Image, Divider } from 'antd';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SafetyCertificateOutlined, SearchOutlined, ArrowLeftOutlined, FilePdfOutlined, DownloadOutlined } from '@ant-design/icons';
import { verifyCertificate } from '../api';
import dayjs from 'dayjs';

interface VerifyCertificateData {
  id: string;
  certificateNo: string;
  templateType: 'certificate' | 'agreement';
  accidentId: string;
  parties: Array<{
    id: string; name: string; plateNo: string; phone: string;
    insuranceCompany: string; liability: 'full' | 'primary' | 'secondary' | 'none';
  }>;
  status: 'draft' | 'issued' | 'verified' | 'revoked';
  issuedAt: string;
  issuedBy: string;
  validUntil: string;
  verifyCode: string;
  pdfUrl?: string;
  qrCodeUrl?: string;
  signatureInfo?: {
    provider: string;
    sealType: string;
    sealSn: string;
    signedAt: string;
    certificateSn: string;
    isValid: boolean;
  };
  accident?: {
    reportNo: string;
    accidentType: string;
    occurTime: string;
    location: string;
    description?: string;
    liabilityResult?: {
      primaryParty: string;
      secondaryParty: string;
      primaryLiability: number;
      secondaryLiability: number;
      liabilityDescription: string;
      legalBasis?: string;
      officer?: string;
    };
  };
}

const liabilityTextMap: Record<string, string> = {
  full: '全部责任', primary: '主要责任', secondary: '次要责任', none: '无责任',
};
const accidentTypeMap: Record<string, string> = {
  rear_end: '追尾', side_swipe: '剐蹭', head_on: '正面碰撞',
  reverse: '倒车事故', intersection: '路口事故', other: '其他',
};
const statusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'orange', text: '草稿' },
  issued: { color: 'green', text: '已出具' },
  verified: { color: 'blue', text: '已核验' },
  revoked: { color: 'red', text: '已撤销' },
};

const CertificateVerify: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    message?: string;
    certificate?: VerifyCertificateData;
  } | null>(null);
  const [inputNo, setInputNo] = useState(searchParams.get('no') || '');
  const [inputCode, setInputCode] = useState(searchParams.get('code') || '');

  useEffect(() => {
    const no = searchParams.get('no');
    const code = searchParams.get('code');
    if (no && code) {
      doVerify(no, code);
    }
  }, []);

  async function doVerify(no?: string, code?: string) {
    const certNo = no || inputNo;
    const verifyCode = code || inputCode;
    if (!certNo || !verifyCode) return;

    setLoading(true);
    try {
      const result = await verifyCertificate(certNo, verifyCode);
      setVerifyResult({
        valid: result?.data?.valid ?? false,
        message: result?.message,
        certificate: result?.data?.certificate || null,
      });
    } catch (e: any) {
      setVerifyResult({ valid: false, message: e?.message || '核验失败' });
    } finally {
      setLoading(false);
    }
  }

  const cert = verifyResult?.certificate;
  const isAgreement = cert?.templateType === 'agreement';

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <SafetyCertificateOutlined style={{ fontSize: 48, color: '#1e5efa' }} />
          <h2 style={{ marginTop: 12 }}>
            {isAgreement ? '道路交通事故自行协商协议书核验' : '道路交通事故认定书核验'}
          </h2>
          <p style={{ color: '#999' }}>输入认定书编号和核验码验证真伪，或扫描二维码直接核验</p>
        </div>

        {(!verifyResult || verifyResult.valid) && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input
              placeholder="认定书编号 / 协议书编号，如 RD202606080001 或 XSSQ202606080001"
              value={inputNo}
              onChange={(e) => setInputNo(e.target.value)}
              size="large"
              prefix={<span style={{ color: '#999' }}>编号</span>}
            />
            <Input
              placeholder="核验码，如 VERIFYABC12345"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              size="large"
              prefix={<span style={{ color: '#999' }}>核验码</span>}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={loading}
              onClick={() => doVerify()}
              block
              size="large"
            >
              立即核验真伪
            </Button>
          </Space>
        )}

        {loading && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Spin tip="核验中，请稍候..." />
          </div>
        )}

        {verifyResult && !loading && (
          <div style={{ marginTop: 24 }}>
            <Result
              status={verifyResult.valid ? 'success' : 'error'}
              title={verifyResult.valid ? '核验通过 · 文件真实有效' : '核验未通过'}
              subTitle={
                verifyResult.valid
                  ? ('该' + (isAgreement ? '自行协商协议书' : '认定书') + '由交通事故快速处理系统签发，与纸质文件具有同等法律效力')
                  : (verifyResult.message || '未找到匹配的认定书信息，可能已被撤销、过期或编号/核验码不正确')
              }
            />

            {verifyResult.valid && cert && (
              <>
                <Divider orientation="left">核验详情</Divider>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e5efa' }}>{cert.certificateNo}</div>
                    <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                      {isAgreement ? '自行协商协议书' : '事故认定书（简易程序）'}
                      <span style={{ marginLeft: 12 }}>
                        <Tag color={statusMap[cert.status]?.color}>{statusMap[cert.status]?.text}</Tag>
                      </span>
                    </div>
                  </div>
                  {cert.qrCodeUrl && (
                    <div style={{ textAlign: 'center' }}>
                      <Image src={cert.qrCodeUrl} alt="核验二维码" width={100} height={100} />
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>扫码核验</div>
                    </div>
                  )}
                </div>

                {cert.accident && (
                  <>
                    <Descriptions title="事故信息" column={2} bordered size="small" style={{ marginBottom: 16 }}>
                      <Descriptions.Item label="事故编号">{cert.accident.reportNo || '—'}</Descriptions.Item>
                      <Descriptions.Item label="事故类型">{accidentTypeMap[cert.accident.accidentType] || cert.accident.accidentType || '—'}</Descriptions.Item>
                      <Descriptions.Item label="发生时间">{dayjs(cert.accident.occurTime).format('YYYY年MM月DD日 HH:mm')}</Descriptions.Item>
                      <Descriptions.Item label="发生地点" span={2}>{cert.accident.location || '—'}</Descriptions.Item>
                    </Descriptions>

                    <Descriptions title="当事人信息" column={1} bordered size="small" style={{ marginBottom: 16 }}>
                      {(cert.parties || []).map((p, idx) => {
                        const tag = idx === 0 ? '甲方' : '乙方';
                        return (
                          <Descriptions.Item key={p.id} label={tag}>
                            <Row gutter={24}>
                              <Col span={6}>姓名：<b>{p.name}</b></Col>
                              <Col span={8}>车牌：<b>{p.plateNo}</b></Col>
                              <Col span={6}>责任：<Tag color="blue">{liabilityTextMap[p.liability] || '—'}</Tag></Col>
                              <Col span={4}>电话：{p.phone || '—'}</Col>
                              <Col span={24} style={{ marginTop: 4 }}>保险公司：{p.insuranceCompany || '—'}</Col>
                            </Row>
                          </Descriptions.Item>
                        );
                      })}
                    </Descriptions>

                    {cert.accident.liabilityResult && (
                      <Descriptions title="责任认定" column={1} bordered size="small" style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="认定结论">
                          {cert.accident.liabilityResult.liabilityDescription}
                        </Descriptions.Item>
                        <Descriptions.Item label="责任比例">
                          甲方 {cert.accident.liabilityResult.primaryLiability}% / 乙方 {cert.accident.liabilityResult.secondaryLiability}%
                        </Descriptions.Item>
                        {cert.accident.liabilityResult.legalBasis && (
                          <Descriptions.Item label="法律依据">{cert.accident.liabilityResult.legalBasis}</Descriptions.Item>
                        )}
                        {cert.accident.liabilityResult.officer && (
                          <Descriptions.Item label="办案民警">{cert.accident.liabilityResult.officer}</Descriptions.Item>
                        )}
                      </Descriptions>
                    )}
                  </>
                )}

                {cert.signatureInfo && (
                  <Descriptions title="电子签章信息" column={2} bordered size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="签章服务商">{cert.signatureInfo.provider}</Descriptions.Item>
                    <Descriptions.Item label="印章类型">{cert.signatureInfo.sealType === 'police' ? '交警部门印章' : '平台电子印章'}</Descriptions.Item>
                    <Descriptions.Item label="印章序列号" code>{cert.signatureInfo.sealSn}</Descriptions.Item>
                    <Descriptions.Item label="证书序列号" code>{cert.signatureInfo.certificateSn}</Descriptions.Item>
                    <Descriptions.Item label="签章时间" span={2}>
                      {dayjs(cert.signatureInfo.signedAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  </Descriptions>
                )}

                <Descriptions title="签发信息" column={2} bordered size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="出具单位">{cert.issuedBy}</Descriptions.Item>
                  <Descriptions.Item label="出具时间">{dayjs(cert.issuedAt).format('YYYY年MM月DD日')}</Descriptions.Item>
                  <Descriptions.Item label="核验码" code>{cert.verifyCode}</Descriptions.Item>
                  <Descriptions.Item label="有效期至">{dayjs(cert.validUntil).format('YYYY年MM月DD日')}</Descriptions.Item>
                </Descriptions>

                <Space wrap style={{ justifyContent: 'center', width: '100%' }}>
                  {cert.pdfUrl && (
                    <Button type="primary" icon={<FilePdfOutlined />} href={cert.pdfUrl} target="_blank">
                      下载PDF文件
                    </Button>
                  )}
                  <Button icon={<DownloadOutlined />} onClick={() => window.open('/api/certificate/' + cert.id + '/pdf', '_blank')}>
                    在线预览PDF
                  </Button>
                </Space>
              </>
            )}

            {!verifyResult.valid && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Button
                  icon={<SearchOutlined />}
                  onClick={() => setVerifyResult(null)}
                >
                  重新核验
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CertificateVerify;
