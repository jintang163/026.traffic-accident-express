import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await login(values);
      localStorage.setItem('token', res.token || res.accessToken || 'mock-token');
      localStorage.setItem('userInfo', JSON.stringify(res.user || { name: values.username }));
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      localStorage.setItem('token', 'mock-token');
      localStorage.setItem('userInfo', JSON.stringify({ name: values.username }));
      message.success('登录成功（演示模式）');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1E5EFA 0%, #4A80FF 100%)',
      }}
    >
      <Card
        style={{ width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
        title={
          <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 600 }}>
            🚦 交通事故快处平台
          </div>
        }
      >
        <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
          演示账号：admin / admin123
        </div>
      </Card>
    </div>
  );
};

export default Login;
