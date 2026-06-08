export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/report/index',
    'pages/certificates/index',
    'pages/mine/index',
    'pages/camera/index',
    'pages/accident-detail/index',
    'pages/certificate-detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1E5EFA',
    navigationBarTitleText: '交通事故快处',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F7FA'
  },
  tabBar: {
    color: '#86909C',
    selectedColor: '#1E5EFA',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页'
      },
      {
        pagePath: 'pages/report/index',
        text: '报案处理'
      },
      {
        pagePath: 'pages/certificates/index',
        text: '认定书'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的'
      }
    ]
  }
})
