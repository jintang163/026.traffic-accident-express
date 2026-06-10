import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import AppLayout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AccidentList from './pages/AccidentList';
import AccidentDetail from './pages/AccidentDetail';
import CertificateList from './pages/CertificateList';
import CertificateDetail from './pages/CertificateDetail';
import CertificateVerify from './pages/CertificateVerify';
import Login from './pages/Login';

const { Content } = Layout;

function App() {
  const isLoggedIn = localStorage.getItem('token');

  if (!isLoggedIn && window.location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <AppLayout>
            <Content style={{ padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/accidents" element={<AccidentList />} />
                <Route path="/accidents/:id" element={<AccidentDetail />} />
                <Route path="/certificates" element={<CertificateList />} />
                <Route path="/certificates/verify" element={<CertificateVerify />} />
                <Route path="/certificates/:id" element={<CertificateDetail />} />
              </Routes>
            </Content>
          </AppLayout>
        }
      />
    </Routes>
  );
}

export default App;
