import { Layout, Menu, Avatar, Dropdown } from 'antd';
import {
  DashboardOutlined,
  CarOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';

const { Header, Sider } = Layout;

const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '统计仪表盘',
  },
  {
    key: '/accidents',
    icon: <CarOutlined />,
    label: '事故审核',
  },
  {
    key: '/certificates',
    icon: <FileTextOutlined />,
    label: '认定书管理',
  },
  {
    key: '/appeals',
    icon: <AuditOutlined />,
    label: '申诉复核',
  },
  {
    key: '/audit-logs',
    icon: <FileSearchOutlined />,
    label: '操作日志',
  },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = '/' + (location.pathname.split('/')[1] || 'dashboard');

  const userMenuItems: MenuProps['items'] = [
    {
      key: '1',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: '2',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    {
      type: 'divider',
    },
    {
      key: '3',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        navigate('/login');
      },
    },
  ];

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 600 }}>
          🚦 事故快处平台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key as string)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            交通事故快速处理平台 - 管理后台
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <span>{userInfo?.name || '管理员'}</span>
            </div>
          </Dropdown>
        </Header>
        {children}
      </Layout>
    </Layout>
  );
};

export default AppLayout;
