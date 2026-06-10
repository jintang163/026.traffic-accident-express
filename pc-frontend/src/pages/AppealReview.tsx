import { Table, Tag, Button, Space, Input, Select, Card, Modal, Form, Descriptions, message } from 'antd';
import { useState, useEffect } from 'react';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminGetAppealList, adminGetAppealDetail, adminReviewAppeal } from '../api';

const { Option } = Select;
const { TextArea } = Input;

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待审核' },
  reviewing: { color: 'blue', text: '复核中' },
  approved: { color: 'green', text: '申诉通过' },
  rejected: { color: 'red', text: '申诉驳回' },
  withdrawn: { color: 'default', text: '已撤回' },
};

const AppealReview: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<any>({});

  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewRecord, setReviewRecord] = useState<any>(null);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminGetAppealList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      });
      setData(res.list || res.data || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch (error) {
      console.error('Load appeal list failed:', error);
      setData(getMockData());
      setPagination((prev) => ({ ...prev, total: 25 }));
    } finally {
      setLoading(false);
    }
  };

  const getMockData = () => {
    const statuses = ['pending', 'reviewing', 'approved', 'rejected', 'withdrawn'];
    const reasons = [
      '责任判定有误，我方不应承担主要责任',
      '对方车辆存在违规变道行为，未在判定中体现',
      '事故现场照片无法真实反映事故情况',
      '对方当事人存在酒驾嫌疑，未进行检测',
      '天气因素未纳入责任判定考量',
    ];
    return Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      appealNo: `AP2026060${8 - Math.floor(i / 3)}000${i + 1}`,
      accidentId: `SG2026060${8 - Math.floor(i / 3)}000${i + 1}`,
      reason: reasons[i % reasons.length],
      status: statuses[i % statuses.length],
      createdAt: `2026-06-0${8 - Math.floor(i / 3)} ${10 + i}:${30 + i * 5}:00`,
    }));
  };

  const handleReview = async (record: any) => {
    setReviewRecord(record);
    setReviewLoading(true);
    setReviewVisible(true);
    try {
      const res = await adminGetAppealDetail(record.id);
      setReviewDetail(res);
    } catch (error) {
      console.error('Load appeal detail failed:', error);
      setReviewDetail({
        id: record.id,
        appealNo: record.appealNo,
        accidentId: record.accidentId,
        reason: record.reason,
        disputedPoints: '责任比例划分不合理，对方应承担更多责任',
        evidence: ['现场照片3张', '行车记录仪视频', '目击证人证词'],
        dashcamVideoUrl: 'https://example.com/dashcam/video.mp4',
        status: record.status,
        createdAt: record.createdAt,
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    try {
      const values = await form.validateFields();
      if (!reviewRecord) return;

      setReviewLoading(true);
      const payload: any = {
        result: values.result,
        reviewComment: values.reviewComment,
      };

      if (values.result === 'approved') {
        payload.newLiability = {
          primaryParty: values.primaryParty,
          primaryLiability: values.primaryLiability,
          secondaryLiability: values.secondaryLiability,
          liabilityDescription: values.liabilityDescription,
        };
      }

      await adminReviewAppeal(reviewRecord.id, payload);
      message.success('审核提交成功');
      setReviewVisible(false);
      form.resetFields();
      setReviewRecord(null);
      setReviewDetail(null);
      loadData();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('审核提交失败');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCancelReview = () => {
    setReviewVisible(false);
    form.resetFields();
    setReviewRecord(null);
    setReviewDetail(null);
  };

  const handleResultChange = () => {
    setTimeout(() => form.validateFields(['result']), 0);
  };

  const columns = [
    { title: '申诉编号', dataIndex: 'appealNo', key: 'appealNo', width: 180 },
    {
      title: '事故编号',
      dataIndex: 'accidentId',
      key: 'accidentId',
      width: 180,
      render: (val: string) => val || '-',
    },
    {
      title: '申诉原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (reason: string) => reason || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const s = statusMap[status] || statusMap.pending;
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '申诉时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          {(record.status === 'pending' || record.status === 'reviewing') && (
            <Button type="link" onClick={() => handleReview(record)}>
              审核
            </Button>
          )}
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
    setTimeout(() => loadData(), 0);
  };

  const resultValue = Form.useWatch('result', form);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">申诉审核</h2>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={16}>
          <Input
            placeholder="搜索申诉编号/事故编号"
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="状态"
            style={{ width: 150 }}
            allowClear
            value={filters.status}
            onChange={(val) => setFilters({ ...filters, status: val })}
          >
            {Object.entries(statusMap).map(([key, val]) => (
              <Option key={key} value={key}>{val.text}</Option>
            ))}
          </Select>
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
          scroll={{ x: 900 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
        />
      </Card>

      <Modal
        title="申诉审核"
        open={reviewVisible}
        width={720}
        onCancel={handleCancelReview}
        onOk={handleSubmitReview}
        confirmLoading={reviewLoading}
        okText="提交审核"
        cancelText="取消"
        destroyOnClose
      >
        {reviewDetail && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="申诉编号">{reviewDetail.appealNo}</Descriptions.Item>
              <Descriptions.Item label="事故编号">{reviewDetail.accidentId}</Descriptions.Item>
              <Descriptions.Item label="申诉原因" span={2}>{reviewDetail.reason}</Descriptions.Item>
              <Descriptions.Item label="争议要点" span={2}>{reviewDetail.disputedPoints}</Descriptions.Item>
              <Descriptions.Item label="证据材料" span={2}>
                {Array.isArray(reviewDetail.evidence)
                  ? reviewDetail.evidence.join('、')
                  : reviewDetail.evidence || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="行车记录仪" span={2}>
                {reviewDetail.dashcamVideoUrl ? (
                  <a href={reviewDetail.dashcamVideoUrl} target="_blank" rel="noopener noreferrer">
                    查看视频
                  </a>
                ) : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="申诉时间" span={2}>{reviewDetail.createdAt}</Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical" preserve={false}>
              <Form.Item
                name="result"
                label="审核结果"
                rules={[{ required: true, message: '请选择审核结果' }]}
              >
                <Select placeholder="请选择审核结果" onChange={handleResultChange}>
                  <Option value="approved">申诉通过</Option>
                  <Option value="rejected">申诉驳回</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="reviewComment"
                label="审核意见"
                rules={[{ required: true, message: '请输入审核意见' }]}
              >
                <TextArea rows={3} placeholder="请输入审核意见" />
              </Form.Item>

              {resultValue === 'approved' && (
                <>
                  <Form.Item
                    name="primaryParty"
                    label="主要责任方"
                    rules={[{ required: true, message: '请输入主要责任方' }]}
                  >
                    <Input placeholder="请输入主要责任方" />
                  </Form.Item>
                  <Form.Item
                    name="primaryLiability"
                    label="主要责任比例(%)"
                    rules={[{ required: true, message: '请输入主要责任比例' }]}
                  >
                    <Input type="number" placeholder="请输入主要责任比例" />
                  </Form.Item>
                  <Form.Item
                    name="secondaryLiability"
                    label="次要责任比例(%)"
                    rules={[{ required: true, message: '请输入次要责任比例' }]}
                  >
                    <Input type="number" placeholder="请输入次要责任比例" />
                  </Form.Item>
                  <Form.Item
                    name="liabilityDescription"
                    label="责任说明"
                    rules={[{ required: true, message: '请输入责任说明' }]}
                  >
                    <TextArea rows={2} placeholder="请输入责任说明" />
                  </Form.Item>
                </>
              )}
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default AppealReview;
